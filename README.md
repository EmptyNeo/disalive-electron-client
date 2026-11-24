# Disalive Desktop

Клиент Disalive для Windows на Electron. Приложение открывает `https://disalive.ru/app/` и использует сервер и API веб-версии. Для работы требуется доступ к сайту.

## Разработка

Требуются Windows x64, Node.js и npm.

```powershell
git clone https://github.com/EmptyNeo/disalive-electron-client.git
cd disalive-electron-client
npm ci
npm start
```

## Сборка установщика

```powershell
npm run make:win
```

Команда создаёт NSIS-установщик `out/1.0.5.0/DLInstall.exe`. Скрипт `build-release.cjs` также кладёт `DLInstall.exe`, архив обновления `disalive.zip` и его контрольную сумму в папку `release` рядом с репозиторием. Иконки генерируются из `assets/Logo.svg`, иконка заголовка берётся из `assets/LogoEmpty.svg`. Папки `node_modules` и `out`, артефакты выпуска и сгенерированные иконки не хранятся в Git.

Окно сворачивается в трей; в меню значка есть «Открыть» и «Выйти». Демонстрация экрана использует выбор окна или экрана, уведомления показываются отдельными карточками Windows. При запуске клиент проверяет `/v1/update/check.php?platform=electron` и при наличии обновления скачивает пакет по адресу из ответа. Если опубликованы размер и SHA-256, клиент проверяет их перед установкой.

## Вспомогательные программы

`hotkey-monitor.exe` обеспечивает глобальные сочетания для PTT и звуковой панели; `update-helper.exe` запускает обновление. Их исходники находятся рядом в `.cs` файлах. При изменении исходников пересоберите программы перед упаковкой:

```powershell
& 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe' /nologo /optimize+ /target:exe /out:hotkey-monitor.exe hotkey-monitor.cs
& 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe' /nologo /optimize+ /target:exe /out:update-helper.exe update-helper.cs
```

После сборки установщика проверьте упаковку обновления командой `npm run test:update-package`.

## Лицензия

MIT. См. [LICENSE](LICENSE).
