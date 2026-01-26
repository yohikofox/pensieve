# Pensine - Infrastructure Homelab

Ce dossier contient la configuration Docker Compose pour l'infrastructure homelab de Pensine.

## 🏗️ Services

L'infrastructure comprend les services suivants :

| Service | Port | Description | Fichier |
|---------|------|-------------|---------|
| **PostgreSQL** | 5432 | Base de données applicative | docker-compose.yml |
| **RabbitMQ** | 5672, 15672 | Message queue + Management UI | docker-compose.yml |
| **MinIO** | 9000, 9001 | Stockage S3-compatible + Console | docker-compose.yml |
| **Docker Registry** | 5000 | Registry privé pour images Docker | docker-compose.registry.yml |
| **Registry UI** | 5001 | Interface web pour le registry | docker-compose.registry.yml |

## 🚀 Démarrage Rapide

### 1. Configurer les variables d'environnement

```bash
# Copier le fichier d'exemple
cp .env.example .env

# Éditer le fichier .env et remplir :
# - Mots de passe pour PostgreSQL, RabbitMQ, MinIO
# - Credentials Supabase (SUPABASE_URL, SUPABASE_ANON_KEY, JWT_SECRET)
nano .env
```

### 2. Démarrer les services

```bash
# Démarrer les services applicatifs (DB, Queue, Storage)
docker-compose up -d

# Démarrer le container registry (séparé)
docker-compose -f docker-compose.registry.yml up -d

# Vérifier que tous les services sont healthy
docker-compose ps
docker-compose -f docker-compose.registry.yml ps

# Voir les logs
docker-compose logs -f
```

### 3. Initialiser le bucket MinIO

```bash
# Installer MinIO Client (une seule fois)
# macOS:
brew install minio/stable/mc

# Linux:
wget https://dl.min.io/client/mc/release/linux-amd64/mc
chmod +x mc
sudo mv mc /usr/local/bin/

# Configurer l'alias MinIO local
mc alias set local http://localhost:9000 minioadmin your-minio-password

# Créer le bucket pour les audios
mc mb local/pensine-audios

# Rendre le bucket accessible en lecture publique
mc anonymous set download local/pensine-audios

# Vérifier
mc ls local
```

### 4. Vérifier les services

```bash
# PostgreSQL
psql postgres://pensine:your-password@localhost:5432/pensine -c "SELECT version();"

# RabbitMQ Management UI
open http://localhost:15672
# Login: pensine / your-rabbitmq-password

# MinIO Console
open http://localhost:9001
# Login: minioadmin / your-minio-password
```

## 🛑 Arrêter les services

```bash
# Arrêter sans supprimer les données
docker-compose stop

# Arrêter et supprimer les conteneurs (données conservées dans volumes)
docker-compose down

# Supprimer TOUT (conteneurs + volumes + données)
docker-compose down -v
```

## 🔍 Troubleshooting

### Port déjà utilisé

Si un port est déjà utilisé, vous pouvez modifier les mappings dans `docker-compose.yml` :

```yaml
ports:
  - "15432:5432"  # Utiliser 15432 au lieu de 5432
```

### Service unhealthy

```bash
# Voir les logs du service problématique
docker-compose logs postgres
docker-compose logs rabbitmq
docker-compose logs minio

# Pour le registry (fichier séparé)
docker-compose -f docker-compose.registry.yml logs registry

# Redémarrer un service spécifique
docker-compose restart postgres
```

### Réinitialiser les données

```bash
# Arrêter et supprimer les volumes
docker-compose down -v

# Redémarrer
docker-compose up -d
```

## 📚 Accès aux services

Une fois démarrés :

- **PostgreSQL:** `localhost:5432`
- **RabbitMQ AMQP:** `localhost:5672`
- **RabbitMQ Management:** http://localhost:15672
- **MinIO API:** `localhost:9000`
- **MinIO Console:** http://localhost:9001
- **Docker Registry:** `localhost:5000`
- **Registry UI:** http://localhost:5001

## 🐳 Docker Registry

### Démarrer/Arrêter le registry

```bash
# Démarrer
docker-compose -f docker-compose.registry.yml up -d

# Arrêter
docker-compose -f docker-compose.registry.yml down

# Voir les logs
docker-compose -f docker-compose.registry.yml logs -f
```

### Configurer Docker pour utiliser le registry local

```bash
# Ajouter le registry comme "insecure" (HTTP local)
# Éditer /etc/docker/daemon.json (Linux) ou Docker Desktop settings (Mac/Windows)
{
  "insecure-registries": ["localhost:5000", "your-homelab-ip:5000"]
}

# Redémarrer Docker après modification
sudo systemctl restart docker  # Linux
# ou redémarrer Docker Desktop
```

### Push une image

```bash
# Tagger l'image pour le registry local
docker tag my-app:latest localhost:5000/my-app:latest

# Push vers le registry
docker push localhost:5000/my-app:latest

# Vérifier dans l'UI
open http://localhost:5001
```

### Pull une image

```bash
# Depuis le même host
docker pull localhost:5000/my-app:latest

# Depuis un autre host du réseau (remplacer par l'IP du serveur)
docker pull 192.168.1.100:5000/my-app:latest
```

### Lister les images

```bash
# Via API
curl http://localhost:5000/v2/_catalog

# Lister les tags d'une image
curl http://localhost:5000/v2/my-app/tags/list
```

### Activer l'authentification (optionnel)

```bash
# Créer le dossier auth
mkdir -p registry/auth

# Créer le fichier htpasswd (installer apache2-utils si nécessaire)
htpasswd -Bc registry/auth/htpasswd admin

# Décommenter les lignes REGISTRY_AUTH dans docker-compose.yml
# Puis redémarrer
docker-compose up -d registry
```

## 🌐 Exposition publique (Cloudflare Tunnel)

Pour exposer les services sur Internet de manière sécurisée, suivre le guide :
```
../../_bmad-output/implementation-artifacts/cloudflare-tunnel-setup-instructions.md
```

Cela permettra d'accéder à :
- `api.pensine.app` → Backend NestJS (port 3000)
- `storage.pensine.app` → MinIO (port 9000)
