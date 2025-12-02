# Simple Chat

Простое веб-приложение для чата в реальном времени с использованием Node.js, Express и Socket.io.

## Возможности

- Обмен сообщениями в реальном времени
- Отображение количества активных пользователей
- Индикатор набора текста
- Уведомления о подключении/отключении пользователей
- Адаптивный дизайн

## Установка

1. Установите зависимости:
```bash
npm install
```

## Запуск

### Режим разработки (с автоперезагрузкой):
```bash
npm run dev
```

### Обычный режим:
```bash
npm start
```

Приложение будет доступно по адресу: http://localhost:3000

## Структура проекта

```
.
├── server.js          # Backend сервер с Socket.io
├── package.json       # Зависимости проекта
├── public/            # Frontend файлы
│   ├── index.html     # HTML разметка
│   ├── style.css      # Стили
│   └── client.js      # Клиентская логика Socket.io
└── README.md          # Документация
```

## Технологии

- **Backend**: Node.js, Express, Socket.io
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Realtime**: WebSockets через Socket.io

## Деплой

Приложение можно задеплоить на:
- **Render**: https://render.com
- **Railway**: https://railway.app
- **Heroku**: https://heroku.com
- **Vercel/Netlify**: потребуется отдельный backend сервис
