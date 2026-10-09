# Бесплатная демоверсия на GitHub Pages

Это обновление для существующего проекта flower-reference. Обычный запуск с SQLite и админкой сохраняется. Для портфолио собирается отдельная статическая версия: главная, каталог, страницы букетов, избранное, корзина и пример оформления. Формы демоверсии не отправляют заявки.

## 1. Скопируйте обновление

Распакуйте архив и перенесите его содержимое в свою папку проекта, согласившись заменить файлы. В корне рядом с package.json должны оказаться PUBLISH-GITHUB-PAGES.md и папка .github. src и scripts объединяются с существующими папками.

Новые зависимости не нужны. Не удаляйте storage, .env или node_modules.

## 2. Настройте репозиторий

Откройте https://github.com/xiseshtormx/flower-reference

Для GitHub Pages на бесплатном тарифе репозиторий должен быть Public. Если он Private: Settings → General → Danger Zone → Change repository visibility → Public. Исходный код станет доступен всем.

В Settings → Pages → Build and deployment → Source выберите GitHub Actions. Готовый шаблон GitHub не добавляйте: файл .github/workflows/deploy-pages.yml уже входит в обновление.

## 3. Проверьте сборку и отправьте обновление

В PowerShell:

```powershell
Set-Location "C:\Users\XiseShtormX\Desktop\Работа\flower-reference"
npm run build:demo
npm run check:demo
git status --short
```

Должны появиться сообщения «Демоверсия готова» и «Демоверсия проверена». В git status должны быть изменения исходников и новая папка .github. .env, storage и dist-demo не должны быть в списке.

Затем:

```powershell
git add .
git commit -m "Add GitHub Pages portfolio demo"
git push origin main
```

## 4. Получите ссылку

Откройте вкладку Actions репозитория. Дождитесь зелёного выполнения Publish flower demo: сначала build, затем deploy.

После успешной публикации сайт будет доступен:

https://xiseshtormx.github.io/flower-reference/

Если запуск не появился: Actions → Publish flower demo → Run workflow → main → Run workflow.

Если есть красный шаг, откройте его и скопируйте текст ошибки. Повторять установку проекта с нуля не нужно.

## Что попадает на сайт

GitHub публикует только dist-demo/client. В неё не входят админка, сервер, база, загруженные через админку фотографии и .env. Публичный репозиторий при этом содержит исходный код серверной части.

Ассортимент демоверсии берётся из src/data/products.ts и фотографий в public/images. Изменения вашей локальной базы из админки автоматически на GitHub Pages не переходят. Для обновления демо меняйте эти исходники и отправляйте коммит — Actions пересоберёт сайт.

Команда npm run dev продолжает запускать полную локальную версию. npm run build и npm start также работают как раньше.

Если переименуете репозиторий, Actions автоматически подставит новое имя в адреса. При локальной сборке по умолчанию используется flower-reference.
