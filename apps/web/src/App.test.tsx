import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('<App /> placeholder title page', () => {
  it('renders the title and engine version through i18n', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Hustle Ring');
    expect(screen.getByTestId('version').textContent).toMatch(/Engine \d+\.\d+\.\d+ · schema v1/);
    expect(screen.getByRole('status')).toBeTruthy();
  });
});
