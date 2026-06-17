# admin-web

Next.js 前端。

- 后端仓库：https://github.com/suipianma/study-nest-js  
- 完整配置见后端仓库 **[SETUP.md](https://github.com/suipianma/study-nest-js/blob/main/SETUP.md)**

## 本地开发（与 study-nest-js 同级目录）

```powershell
npm install
npm run dev
```

访问 http://localhost:3001（API 默认 http://localhost:3000，见 `.env.development`）

## CI/CD

push `main` 会触发两个 Workflow（与后端 `study-nest-js` 结构一致）：

| Workflow | 作用 |
|----------|------|
| **Next.js CI** | `npm ci` → build |
| **Build And Push Docker Image** | 构建并推送 `suipianma/admin-web:latest` |

需在 **admin-web 仓库** Settings 配置：

- Secrets: `DOCKER_USERNAME`, `DOCKER_PASSWORD`（与后端相同）
- Variables: `PUBLIC_API_BASE=http://localhost:3000`

推送后可在 GitHub → Actions 查看运行结果；Docker 部署见后端仓库 `deploy/README.md`。

## 远程

```powershell
git remote add origin https://github.com/suipianma/admin-web.git
git push -u origin main
```
