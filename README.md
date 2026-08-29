# Float Android Updates

Float Android APK 的公开更新源。

## 当前版本

- 版本：1.1.0
- versionCode：2
- 安装包：`Float-Android-v1.1.0.apk`
- SHA-256：`48DC522BA831D3F3010A6D7B0FD9AD3FD7C19E869B835355CAE0928075D8CA8F`

## 更新机制

APK 启动后读取仓库根目录的 `latest.json`。发现更高的 `versionCode` 后，应用会提示下载，校验 SHA-256，再调用 Android 系统安装器完成覆盖更新。

普通 Android 应用不能静默安装，因此每次更新仍需用户确认系统安装提示。

## 发布新版本

1. 递增 Android `versionCode` 和 `versionName`。
2. 使用与已安装版本相同的签名构建 APK。
3. 新建 GitHub Release，并上传 APK。
4. 更新 `latest.json` 中的版本、下载地址、SHA-256 和更新说明。
