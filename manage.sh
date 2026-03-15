#!/bin/bash
# Family Recipes – management helper
set -e

CMD=${1:-help}

case "$CMD" in
  start)
    echo "🚀 Starting Family Recipes..."
    docker compose up -d --build
    echo "✅ Running at http://localhost"
    ;;
  stop)
    docker compose down
    echo "🛑 Stopped"
    ;;
  restart)
    docker compose restart
    ;;
  logs)
    docker compose logs -f ${2:-backend}
    ;;
  backup)
    TS=$(date +%Y%m%d_%H%M%S)
    FILE="backup_${TS}.sql"
    docker exec recipes_db pg_dump -U recipes_user recipes > "$FILE"
    echo "✅ Backup saved: $FILE"
    ;;
  restore)
    if [ -z "$2" ]; then echo "Usage: $0 restore <file.sql>"; exit 1; fi
    docker exec -i recipes_db psql -U recipes_user recipes < "$2"
    echo "✅ Restored from $2"
    ;;
  status)
    docker compose ps
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|logs [service]|backup|restore <file>|status}"
    ;;
esac
