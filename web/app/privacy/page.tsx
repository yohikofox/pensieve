import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politique de Confidentialité - Pensine",
  description: "Politique de confidentialité de l'application Pensine",
};

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <article className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm p-8 md:p-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Politique de Confidentialité
        </h1>
        <p className="text-gray-500 mb-8">Dernière mise à jour : 26 janvier 2025</p>

        <div className="prose prose-gray max-w-none">
          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">1. Introduction</h2>
          <p className="text-gray-700 mb-4">
            Pensine ("nous", "notre", "l'application") est une application mobile de capture
            et d'organisation de pensées vocales. Cette politique de confidentialité explique
            comment nous collectons, utilisons, stockons et protégeons vos données personnelles.
          </p>
          <p className="text-gray-700 mb-4">
            En utilisant Pensine, vous acceptez les pratiques décrites dans cette politique.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">2. Données collectées</h2>

          <h3 className="text-lg font-medium text-gray-900 mt-6 mb-3">2.1 Données de compte</h3>
          <ul className="list-disc pl-6 text-gray-700 mb-4">
            <li>Adresse email (pour l'authentification)</li>
            <li>Identifiant utilisateur unique</li>
          </ul>

          <h3 className="text-lg font-medium text-gray-900 mt-6 mb-3">2.2 Données de capture</h3>
          <ul className="list-disc pl-6 text-gray-700 mb-4">
            <li>Enregistrements audio de vos pensées vocales</li>
            <li>Transcriptions textuelles générées</li>
            <li>Analyses IA (résumés, points clés, actions)</li>
            <li>Métadonnées (date de création, durée)</li>
          </ul>

          <h3 className="text-lg font-medium text-gray-900 mt-6 mb-3">2.3 Intégrations tierces</h3>
          <p className="text-gray-700 mb-4">
            <strong>Google Calendar :</strong> Si vous connectez votre compte Google, nous accédons à :
          </p>
          <ul className="list-disc pl-6 text-gray-700 mb-4">
            <li>Votre adresse email Google (pour identifier le compte connecté)</li>
            <li>Permission de créer des événements dans votre calendrier principal</li>
          </ul>
          <p className="text-gray-700 mb-4">
            Nous n'accédons pas à vos événements existants et ne lisons pas votre calendrier.
            Nous créons uniquement des événements lorsque vous le demandez explicitement.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">3. Traitement des données</h2>

          <h3 className="text-lg font-medium text-gray-900 mt-6 mb-3">3.1 Traitement local</h3>
          <p className="text-gray-700 mb-4">
            La majorité du traitement s'effectue <strong>localement sur votre appareil</strong> :
          </p>
          <ul className="list-disc pl-6 text-gray-700 mb-4">
            <li>Transcription vocale via Whisper (modèle local)</li>
            <li>Analyse IA via LLM local (Gemma, etc.)</li>
            <li>Stockage des captures dans une base de données locale</li>
          </ul>

          <h3 className="text-lg font-medium text-gray-900 mt-6 mb-3">3.2 Données transmises</h3>
          <p className="text-gray-700 mb-4">
            Les seules données transmises à nos serveurs sont :
          </p>
          <ul className="list-disc pl-6 text-gray-700 mb-4">
            <li>Informations d'authentification (via Better Auth)</li>
            <li>Données de synchronisation (si activée)</li>
          </ul>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">4. Utilisation des données</h2>
          <p className="text-gray-700 mb-4">Nous utilisons vos données pour :</p>
          <ul className="list-disc pl-6 text-gray-700 mb-4">
            <li>Fournir les fonctionnalités de l'application</li>
            <li>Authentifier votre compte</li>
            <li>Synchroniser vos données entre appareils (si activé)</li>
            <li>Améliorer nos services</li>
          </ul>
          <p className="text-gray-700 mb-4">
            <strong>Nous ne vendons jamais vos données à des tiers.</strong>
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">5. Stockage et sécurité</h2>
          <ul className="list-disc pl-6 text-gray-700 mb-4">
            <li>Les données locales sont stockées de manière sécurisée sur votre appareil</li>
            <li>Les tokens d'authentification sont stockés dans le Secure Store de l'appareil</li>
            <li>Les communications sont chiffrées via HTTPS</li>
            <li>Les données synchronisées sont hébergées sur des serveurs sécurisés (homelab auto-hébergé)</li>
          </ul>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">6. Vos droits (RGPD)</h2>
          <p className="text-gray-700 mb-4">
            Conformément au Règlement Général sur la Protection des Données, vous avez le droit de :
          </p>
          <ul className="list-disc pl-6 text-gray-700 mb-4">
            <li><strong>Accès :</strong> Obtenir une copie de vos données personnelles</li>
            <li><strong>Rectification :</strong> Corriger des données inexactes</li>
            <li><strong>Effacement :</strong> Demander la suppression de vos données</li>
            <li><strong>Portabilité :</strong> Exporter vos données dans un format standard</li>
            <li><strong>Opposition :</strong> Vous opposer à certains traitements</li>
          </ul>
          <p className="text-gray-700 mb-4">
            Ces options sont accessibles directement dans l'application via
            <strong> Paramètres &gt; Confidentialité & Données</strong>.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">7. Services tiers</h2>
          <p className="text-gray-700 mb-4">Pensine utilise les services suivants :</p>
          <ul className="list-disc pl-6 text-gray-700 mb-4">
            <li><strong>Better Auth :</strong> Authentification auto-hébergée</li>
            <li><strong>Google Calendar API :</strong> Création d'événements (optionnel)</li>
            <li><strong>HuggingFace :</strong> Téléchargement de modèles IA (optionnel)</li>
          </ul>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">8. Conservation des données</h2>
          <p className="text-gray-700 mb-4">
            Vos données sont conservées tant que votre compte est actif.
            En cas de suppression de compte, toutes vos données sont effacées
            de manière irréversible dans un délai de 30 jours.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">9. Modifications</h2>
          <p className="text-gray-700 mb-4">
            Nous pouvons mettre à jour cette politique. Les modifications significatives
            seront notifiées via l'application ou par email.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">10. Contact</h2>
          <p className="text-gray-700 mb-4">
            Pour toute question concernant cette politique ou vos données :
          </p>
          <p className="text-gray-700 mb-4">
            <strong>Email :</strong> privacy@pensine.app
          </p>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-200">
          <a href="/" className="text-primary-600 hover:text-primary-700 font-medium">
            ← Retour à l'accueil
          </a>
        </div>
      </article>
    </main>
  );
}
