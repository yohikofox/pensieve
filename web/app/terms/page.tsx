import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Conditions d'Utilisation - Pensine",
  description: "Conditions générales d'utilisation de l'application Pensine",
};

export default function TermsOfService() {
  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <article className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm p-8 md:p-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Conditions d'Utilisation
        </h1>
        <p className="text-gray-500 mb-8">Dernière mise à jour : 26 janvier 2025</p>

        <div className="prose prose-gray max-w-none">
          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">1. Acceptation des conditions</h2>
          <p className="text-gray-700 mb-4">
            En téléchargeant, installant ou utilisant l'application Pensine ("l'Application"),
            vous acceptez d'être lié par ces Conditions d'Utilisation. Si vous n'acceptez pas
            ces conditions, veuillez ne pas utiliser l'Application.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">2. Description du service</h2>
          <p className="text-gray-700 mb-4">
            Pensine est une application mobile permettant de :
          </p>
          <ul className="list-disc pl-6 text-gray-700 mb-4">
            <li>Enregistrer des pensées vocales</li>
            <li>Transcrire automatiquement les enregistrements en texte</li>
            <li>Analyser le contenu via intelligence artificielle</li>
            <li>Organiser et gérer vos captures</li>
            <li>Créer des événements dans votre calendrier (optionnel)</li>
          </ul>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">3. Compte utilisateur</h2>
          <p className="text-gray-700 mb-4">
            Pour utiliser certaines fonctionnalités, vous devez créer un compte.
            Vous êtes responsable de :
          </p>
          <ul className="list-disc pl-6 text-gray-700 mb-4">
            <li>Fournir des informations exactes et à jour</li>
            <li>Maintenir la confidentialité de vos identifiants</li>
            <li>Toutes les activités effectuées sous votre compte</li>
          </ul>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">4. Utilisation acceptable</h2>
          <p className="text-gray-700 mb-4">Vous vous engagez à ne pas utiliser l'Application pour :</p>
          <ul className="list-disc pl-6 text-gray-700 mb-4">
            <li>Violer des lois ou réglementations</li>
            <li>Enregistrer des conversations sans le consentement des participants</li>
            <li>Stocker du contenu illégal, diffamatoire ou offensant</li>
            <li>Tenter de contourner les mesures de sécurité</li>
            <li>Utiliser l'Application à des fins commerciales non autorisées</li>
          </ul>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">5. Propriété intellectuelle</h2>
          <p className="text-gray-700 mb-4">
            L'Application, son code, son design et ses fonctionnalités sont protégés par
            les lois sur la propriété intellectuelle. Vous ne pouvez pas :
          </p>
          <ul className="list-disc pl-6 text-gray-700 mb-4">
            <li>Copier, modifier ou distribuer l'Application</li>
            <li>Désassembler ou faire de l'ingénierie inverse</li>
            <li>Utiliser nos marques sans autorisation</li>
          </ul>
          <p className="text-gray-700 mb-4">
            <strong>Votre contenu :</strong> Vous conservez tous les droits sur le contenu
            que vous créez (enregistrements, transcriptions). Nous n'utilisons pas votre
            contenu à d'autres fins que de vous fournir le service.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">6. Intégrations tierces</h2>
          <p className="text-gray-700 mb-4">
            L'Application peut s'intégrer à des services tiers (Google Calendar, HuggingFace).
            L'utilisation de ces services est soumise à leurs propres conditions d'utilisation.
            Nous ne sommes pas responsables de ces services tiers.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">7. Limitation de responsabilité</h2>
          <p className="text-gray-700 mb-4">
            L'Application est fournie "en l'état" sans garantie d'aucune sorte.
            Dans les limites permises par la loi :
          </p>
          <ul className="list-disc pl-6 text-gray-700 mb-4">
            <li>Nous ne garantissons pas que l'Application sera exempte d'erreurs</li>
            <li>Nous ne sommes pas responsables des pertes de données</li>
            <li>Nous ne sommes pas responsables des dommages indirects</li>
            <li>Notre responsabilité totale est limitée au montant payé pour l'Application</li>
          </ul>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">8. Résiliation</h2>
          <p className="text-gray-700 mb-4">
            Vous pouvez cesser d'utiliser l'Application à tout moment en la désinstallant
            et en supprimant votre compte.
          </p>
          <p className="text-gray-700 mb-4">
            Nous nous réservons le droit de suspendre ou résilier votre accès en cas de
            violation de ces conditions, sans préavis.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">9. Modifications</h2>
          <p className="text-gray-700 mb-4">
            Nous pouvons modifier ces conditions à tout moment. Les modifications
            entreront en vigueur dès leur publication. L'utilisation continue de
            l'Application après modification constitue une acceptation des nouvelles conditions.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">10. Droit applicable</h2>
          <p className="text-gray-700 mb-4">
            Ces conditions sont régies par le droit français. Tout litige sera soumis
            à la compétence exclusive des tribunaux français.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">11. Contact</h2>
          <p className="text-gray-700 mb-4">
            Pour toute question concernant ces conditions :
          </p>
          <p className="text-gray-700 mb-4">
            <strong>Email :</strong> contact@pensine.app
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
