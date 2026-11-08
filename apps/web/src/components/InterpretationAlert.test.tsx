import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InterpretationAlert } from './InterpretationAlert';

describe('InterpretationAlert', () => {
  it('mostra a mensagem com role="alert"', () => {
    render(<InterpretationAlert message="Não consegui interpretar." />);

    expect(screen.getByRole('alert').textContent).toBe('Não consegui interpretar.');
  });
});
