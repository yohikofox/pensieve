export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-br from-primary-600 to-primary-900">
      <div className="text-center text-white max-w-2xl">
        <h1 className="text-5xl font-bold mb-6">Pensine</h1>
        <p className="text-xl mb-8 text-primary-100">
          Capturez vos pensées, transcrivez-les automatiquement,
          et laissez l'IA vous aider à les organiser.
        </p>
        <div className="flex gap-4 justify-center">
          <a
            href="#"
            className="bg-white text-primary-700 px-6 py-3 rounded-lg font-semibold hover:bg-primary-50 transition"
          >
            App Store (bientôt)
          </a>
          <a
            href="#"
            className="bg-primary-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-400 transition border border-primary-400"
          >
            Google Play (bientôt)
          </a>
        </div>
      </div>

      <footer className="absolute bottom-8 text-primary-200 text-sm">
        <a href="/privacy" className="hover:text-white mr-6">Politique de confidentialité</a>
        <a href="/terms" className="hover:text-white">Conditions d'utilisation</a>
      </footer>
    </main>
  );
}
