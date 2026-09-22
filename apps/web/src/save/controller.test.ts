import { loadPack } from '@hustle-ring/content';
import { createGame, stateHash, type Command } from '@hustle-ring/engine';
import { MemorySaveStore, type SaveRecord } from '@hustle-ring/platform';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGame } from '../store/gameStore';
import { buildConfig, defaultSeat } from '../ui/screens/SetupScreen';
import { makeSave } from './codec';
import { SaveController, type SaveStatus } from './controller';

const cfg = (seed = 'saved', humans = 1) =>
  buildConfig(
    'classic',
    Array.from({ length: humans }, (_, i) => defaultSeat(i, 'human-local', `P${i}`)),
    seed,
    'off',
    false,
    true,
  );
let controller: SaveController;
let store: MemorySaveStore;
let status: Partial<SaveStatus>;
beforeEach(() => {
  useGame.getState().quit();
  store = new MemorySaveStore();
  status = {};
  controller = new SaveController(store, (patch) => {
    status = { ...status, ...patch };
  });
});
afterEach(async () => {
  controller.close();
  useGame.getState().quit();
  await controller.settled();
  vi.restoreAllMocks();
});

describe('save lifecycle', () => {
  it('autosaves new games, every tenth command and end turns, and retains all three slots', async () => {
    useGame.getState().startGame(cfg());
    await controller.settled();
    expect((await store.get('autosave'))?.week).toBe(1);
    for (let i = 0; i < 9; i++)
      useGame.getState().dispatch({ type: i % 2 === 0 ? 'Exit' : 'Enter' });
    await controller.settled();
    expect((await store.get('autosave'))?.commandLog).toHaveLength(0);
    useGame.getState().dispatch({ type: 'Enter' });
    await controller.settled();
    expect((await store.get('autosave'))?.commandLog).toHaveLength(10);
    for (const slot of ['slot-1', 'slot-2', 'slot-3'] as const) await controller.save(slot);
    useGame.getState().dispatch({ type: 'EndTurn' });
    await controller.settled();
    expect((await store.get('autosave'))?.week).toBe(2);
    expect(await store.list()).toHaveLength(4);
    await controller.remove('slot-3');
    expect(await store.get('slot-3')).toBeNull();
  });
  it('restores exact state after quit and uses the hotseat privacy screen', async () => {
    useGame.getState().startGame(cfg('hotseat', 2));
    useGame.getState().ready();
    useGame.getState().dispatch({ type: 'Exit' });
    const expected = structuredClone(useGame.getState().state!);
    await controller.save('slot-1');
    useGame.getState().quit();
    await controller.load('slot-1');
    expect(useGame.getState().state).toEqual(expected);
    expect(useGame.getState().screen).toBe('pass');
    expect(status.warning).toBe(false);
  });
  it('preserves game and records on rejected imports and failed writes, then recovers', async () => {
    useGame.getState().startGame(cfg());
    await controller.save('slot-1');
    const current = useGame.getState().state;
    const before = await store.get('autosave');
    await controller.import('{');
    expect(status.error).toBe('invalid');
    expect(useGame.getState().state).toBe(current);
    expect(await store.get('autosave')).toEqual(before);
    const fail = vi.spyOn(store, 'put').mockRejectedValue(new Error('quota'));
    const text = JSON.stringify(
      makeSave(createGame(cfg('imported'), loadPack('classic')), 'evil-target'),
    );
    await controller.import(text);
    expect(status.error).toBe('storage');
    expect(useGame.getState().state).toBe(current);
    expect(await store.get('autosave')).toEqual(before);
    fail.mockRestore();
    await controller.import(text);
    expect(useGame.getState().state?.config.seed).toBe('imported');
    expect((await store.get('slot-1'))?.snapshot).toEqual(current);
    expect(await store.get('evil-target')).toBeNull();
  });
  it('serializes old autosaves before new-game/import saves and captures immutable snapshots', async () => {
    let release!: () => void;
    const put = store.put.bind(store);
    const writes: SaveRecord[] = [];
    vi.spyOn(store, 'put').mockImplementation(async (rec) => {
      writes.push(rec);
      if (writes.length === 1)
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      await put(rec);
    });
    useGame.getState().startGame(cfg('old'));
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    useGame.getState().dispatch({ type: 'EndTurn' });
    useGame.getState().startGame(cfg('new'));
    expect(writes).toHaveLength(1);
    release();
    await controller.settled();
    expect(writes[0]?.commandLog).toHaveLength(0);
    expect((await store.get('autosave'))?.config).toEqual(useGame.getState().state?.config);
  });
  it('cancels stale AI results and resumes a loaded AI turn only once', async () => {
    const original = useGame.getState().aiClient;
    const pending: ((cmds: Command[]) => void)[] = [];
    const cancelPending = vi.fn();
    useGame.setState({
      aiClient: {
        plan: () => new Promise((resolve) => pending.push(resolve)),
        cancelPending,
        dispose: vi.fn(),
      },
    });
    try {
      const aiCfg = buildConfig(
        'classic',
        [defaultSeat(0, 'ai', 'AI'), defaultSeat(1, 'human-local', 'You')],
        'ai-save',
        'off',
        false,
        false,
      );
      const aiState = createGame(aiCfg, loadPack('classic'));
      useGame.getState().startGame(aiCfg);
      await controller.save('slot-1');
      expect(pending).toHaveLength(1);
      await controller.load('slot-1');
      expect(pending).toHaveLength(2);
      pending[0]!([{ type: 'EndTurn' }]);
      await Promise.resolve();
      expect(stateHash(useGame.getState().state!)).toBe(stateHash(aiState));
      expect(useGame.getState().aiThinking).toBe(true);
      expect(cancelPending).toHaveBeenCalled();
      useGame.getState().quit();
      pending[1]!([]);
    } finally {
      useGame.setState({ aiClient: original });
    }
  });
  it('shows replay mismatch as a warning and restores the checked snapshot', async () => {
    const changed = createGame(cfg('drift'), loadPack('classic'));
    changed.players[0]!.cash += 25;
    await store.put(makeSave(changed, 'slot-1'));
    await controller.load('slot-1');
    expect(status.warning).toBe(true);
    expect(status.error).toBeNull();
    expect(useGame.getState().state?.players[0]?.cash).toBe(changed.players[0]?.cash);
  });
  it('prevents a slow load from replacing a newly started game', async () => {
    await store.put(makeSave(createGame(cfg('old'), loadPack('classic')), 'slot-1'));
    let release!: (r: SaveRecord | null) => void;
    vi.spyOn(store, 'get').mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const loading = controller.load('slot-1');
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    useGame.getState().startGame(cfg('new'));
    release(makeSave(createGame(cfg('old'), loadPack('classic')), 'slot-1'));
    await loading;
    await controller.settled();
    expect(useGame.getState().state?.config.seed).toBe('new');
    expect(useGame.getState().loading).toBe(false);
  });
});
