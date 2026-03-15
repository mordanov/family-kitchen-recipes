# 📖 Книга семейных рецептов

Web-приложение для хранения семейных рецептов, расчёта КБЖУ через OpenAI и составления меню на 1–4 недели.

## Стек
- **Backend**: Python 3.12 + FastAPI + SQLAlchemy (async) + Alembic
- **Frontend**: Vanilla JS + HTML/CSS (без фреймворков)
- **База данных**: PostgreSQL 16
- **Прокси**: Nginx
- **Контейнеризация**: Docker + Docker Compose

---

## 🚀 Быстрый запуск

### 1. Клонировать/распаковать проект

### 2. Создать `.env` из шаблона
```bash
cp .env.example .env
```

### 3. Отредактировать `.env`
```env
POSTGRES_PASSWORD=ваш_пароль_бд
SECRET_KEY=длинная_случайная_строка_минимум_32_символа
OPENAI_API_KEY=sk-...       # ключ OpenAI для расчёта КБЖУ
USER1_NAME=имя_первого      # логин первого пользователя
USER1_PASSWORD=пароль1
USER2_NAME=имя_второго
USER2_PASSWORD=пароль2
```

### 4. Запустить
```bash
docker compose up -d --build
```

### 5. Открыть в браузере
```
http://localhost
```

---

## 📦 Структура проекта
```
family-recipes/
├── backend/
│   ├── app/
│   │   ├── api/          # FastAPI роутеры
│   │   ├── services/     # КБЖУ через OpenAI
│   │   ├── models.py     # SQLAlchemy модели
│   │   ├── schemas.py    # Pydantic схемы
│   │   ├── auth.py       # JWT авторизация
│   │   ├── config.py     # Настройки из env
│   │   ├── database.py   # Подключение к БД
│   │   ├── init_db.py    # Инициализация пользователей
│   │   └── main.py       # FastAPI приложение
│   ├── alembic/          # Миграции БД
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── public/
│   │   ├── index.html    # SPA приложение
│   │   └── js/
│   │       ├── api.js    # API клиент
│   │       ├── app.js    # Роутинг, авторизация, тосты
│   │       ├── recipes.js
│   │       ├── menu.js
│   │       └── shopping.js
│   ├── server.js         # Express для статики
│   ├── package.json
│   └── Dockerfile
├── nginx/
│   └── nginx.conf
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## ⚙️ Функции

### Рецепты
- Создание и редактирование рецептов
- Список ингредиентов для готовки + закупочный список
- Способы приготовления: варка, жарка, тушение, аэрогриль, запекание, сырое
- Фото блюда
- Дополнительная заметка (не влияет на КБЖУ)
- Автоматический расчёт КБЖУ через OpenAI API (фон)

### Меню
- Создание меню на 1–4 недели
- Добавление блюд по неделям (блюдо можно добавить несколько раз)
- Отметка «приготовлено»
- Прогресс-бар выполнения
- Досрочное закрытие меню
- Только одно активное меню одновременно

### Список покупок
- Формируется из закупочных списков **неприготовленных** блюд активного меню
- Кнопка печати

### История меню
- Все меню с прогрессом
- Просмотр состава любого меню

---

## 🔑 Смена паролей
Отредактируйте `.env` и перезапустите сервисы:
```bash
docker compose restart backend
```
Пароли обновляются автоматически при старте.

---

## 🛠 Обслуживание

```bash
# Логи
docker compose logs -f backend

# Перезапуск
docker compose restart

# Остановка
docker compose down

# Бэкап БД
docker exec recipes_db pg_dump -U recipes_user recipes > backup.sql
```
