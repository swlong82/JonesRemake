import { createLocalServices, type PlatformServices } from '@hustle-ring/platform';
import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { SaveController, useSaves } from '../save/controller';

const localServices = createLocalServices({
  newId: () => crypto.randomUUID(),
  indexedDB: () => globalThis.indexedDB,
  platform: {
    open: (url) => {
      window.open(url, '_blank', 'noopener,noreferrer');
    },
  },
});
const Services = createContext<PlatformServices>(localServices);
export function ServicesProvider({
  children,
  services = localServices,
}: {
  children: ReactNode;
  services?: PlatformServices;
}) {
  return <Services.Provider value={services}>{children}</Services.Provider>;
}
export function useSaveConnection(): void {
  const services = useContext(Services);
  useEffect(() => {
    const controller = new SaveController(services.saves);
    useSaves.setState({ controller });
    void controller.refresh();
    return () => {
      controller.close();
      useSaves.setState({ controller: null });
    };
  }, [services]);
}
