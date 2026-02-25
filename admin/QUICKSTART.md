# 🚀 Quickstart - Backoffice Admin Pensieve

Guide de démarrage ultra-rapide (5 minutes).

---

## Étape 1 : Backend (1 min)

```bash
cd backend
npm install
npm run migration:run
npm run seed:authorization
npm run start:dev
```

✅ Le backend tourne sur `http://localhost:3000`

---

## Étape 2 : Admin Frontend (1 min)

```bash
cd admin
npm install
cp .env.example .env
# Éditer .env avec NEXT_PUBLIC_API_URL (URL du backend Better Auth)
npm run dev
```

✅ Le frontend tourne sur `http://localhost:3001`

---

## Étape 3 : Créer un admin (2 min)

**Option rapide : Via psql**

```bash
# Se connecter à PostgreSQL
psql -U postgres -d pensieve

# Trouver un user existant (ou créer)
SELECT id, email FROM users LIMIT 5;

# Assigner le rôle admin
INSERT INTO user_roles (user_id, role_id)
SELECT 'COPIER-LE-USER-ID-ICI', id FROM roles WHERE name = 'admin';
```

**Option alternative : Via le sync endpoint Better Auth**

1. S'assurer que l'utilisateur existe dans Better Auth (signup ou admin API)
2. Appeler `POST /api/admin/users/sync` pour synchroniser les users dans PostgreSQL
3. Exécuter le SQL ci-dessus avec l'ID récupéré

---

## Étape 4 : Se connecter (30 sec)

1. Ouvrir http://localhost:3001
2. Cliquer "Se connecter avec Google"
3. Authentifier avec le compte Google de l'admin
4. Vous êtes sur le dashboard ! 🎉

---

## Étape 5 : Tester les pages (30 sec)

Naviguer dans la sidebar :

- **Dashboard** : Voir les statistiques
- **Utilisateurs** : Liste des users
- **Rôles** : Créer un rôle custom
- **Permissions** : Voir toutes les permissions
- **Abonnements** : Créer un tier custom
- **Contenu** : Statistiques thoughts/ideas/todos

---

## 🐛 Problème ?

### "admin.access permission denied"

Votre user n'a pas le rôle admin. Vérifier :

```sql
SELECT u.email, r.name
FROM users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
LEFT JOIN roles r ON ur.role_id = r.id
WHERE u.email = 'votre@email.com';
```

Si pas de rôle `admin`, refaire l'Étape 3.

### "Failed to load users"

Backend pas lancé ou mauvaise URL. Vérifier :
- Backend tourne sur port 3000
- `.env` contient `NEXT_PUBLIC_API_URL=http://localhost:3000`

### "Unauthorized" / "Invalid JWT"

Token admin JWT invalide. Solution :
1. Supprimer `admin_token` dans localStorage (DevTools > Application > Local Storage)
2. Se reconnecter

---

## ✅ Tout fonctionne !

Consultez `README.md` pour le guide complet.

Consultez `IMPLEMENTATION_SUMMARY.md` pour la doc technique.

---

**Temps total : ~5 minutes** ⏱️
