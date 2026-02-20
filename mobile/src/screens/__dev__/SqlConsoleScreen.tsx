/**
 * SQL Console Screen — Dev Tool
 *
 * Écran de debug pour exécuter des requêtes SQL sur la DB OP-SQLite locale.
 * Accessible depuis les Settings en mode debug uniquement.
 */

import React from 'react';
import { StandardLayout } from '../../components/layouts';
import { SqlConsole } from '../../components/dev/SqlConsole';

export const SqlConsoleScreen: React.FC = () => {
  return (
    <StandardLayout>
      <SqlConsole />
    </StandardLayout>
  );
};
