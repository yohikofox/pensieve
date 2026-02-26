// AUCUN import — ce fichier doit s'exécuter avant react-native
// Il intercepte console.error AVANT que LogBox ne l'enveloppe,
// garantissant que LogBox capture les stack traces depuis le code utilisateur.

type EarlyErrorEntry = {
  args: unknown[];
  timestamp: Date;
};

const earlyBuffer: EarlyErrorEntry[] = [];
let forwarder: ((entry: EarlyErrorEntry) => void) | null = null;

// Sauvegarde du console.error NATIF avant que LogBox ne l'enveloppe
const nativeConsoleError = console.error;

console.error = (...args: unknown[]) => {
  const entry: EarlyErrorEntry = { args, timestamp: new Date() };
  if (forwarder) {
    forwarder(entry);
  } else {
    earlyBuffer.push(entry);
  }
  // Appel natif toujours effectué → LogBox peut l'envelopper correctement
  // La stack trace est capturée ici par LogBox (pas dans notre wrapper) ✅
  nativeConsoleError(...args);
};

export function installErrorForwarder(
  fn: (entry: EarlyErrorEntry) => void
): void {
  forwarder = fn;
  // Vider le buffer d'erreurs antérieures à l'init du store
  const buffered = earlyBuffer.splice(0);
  for (const entry of buffered) {
    fn(entry);
  }
}
