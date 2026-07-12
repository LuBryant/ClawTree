# ClawTree 宝塔面板生产部署手册

本文档对应当前仓库的真实结构：

- 前端：Next.js 16，由 PM2 守护，监听 `127.0.0.1:3000`
- 后端：Django + Gunicorn，由 Supervisor 守护，监听 `127.0.0.1:8000`
- 数据库：推荐 MySQL 8，字符集 `utf8mb4`
- 入口：宝塔 Nginx 统一提供 HTTP/HTTPS、反向代理和静态文件

> 不要把前端导出成纯静态站点。项目包含 `frontend/app/api/**/route.ts` 服务端接口，必须持续运行 Next.js Node 进程。

## 1. 部署变量

执行命令前先替换以下示例值：

| 变量 | 示例 | 说明 |
| --- | --- | --- |
| `APP_DIR` | `/www/wwwroot/ClawTree` | 仓库绝对路径 |
| `DOMAIN` | `example.com` | 主站域名 |
| `WWW_DOMAIN` | `www.example.com` | 可选的 www 域名 |
| `OPS_DOMAIN` | `ops.example.com` | 推荐的 Django Admin 运维子域 |
| `APP_USER` | `www` | 宝塔/Nginx/Supervisor 运行用户 |

本手册以下命令默认：

```bash
APP_DIR=/www/wwwroot/ClawTree
DOMAIN=example.com
```

宝塔中的实际项目路径和用户可能不同，必须以服务器为准。

## 2. 推荐服务器规格与软件

比赛演示最低建议 2 核 CPU、4 GB 内存、40 GB SSD；对外试运营建议 4 核、8 GB 内存以上。

在宝塔“软件商店”中安装：

1. Nginx 1.24 或更高版本；
2. MySQL 8.0；
3. Python 3.11 或 3.12；
4. Supervisor 管理器；
5. Node.js 版本管理器，并安装 Node.js 22 LTS；
6. PM2 管理器或全局 PM2。

检查版本：

```bash
node -v
npm -v
python3 --version
nginx -v
```

Node.js 必须不低于 `20.9.0`，推荐使用 Node.js 22 LTS。

如果安装 `mysqlclient` 时编译失败，Ubuntu/Debian 可先安装：

```bash
apt update
apt install -y build-essential python3-dev default-libmysqlclient-dev pkg-config
```

CentOS/AlmaLinux 应安装等价的 Python、GCC 和 MySQL/MariaDB 开发包。

## 3. 域名、防火墙与目录

1. 将 `DOMAIN`、`WWW_DOMAIN` 和可选的 `OPS_DOMAIN` A 记录解析到服务器公网 IP。
2. 云安全组和系统防火墙只开放 `22`（或自定义 SSH 端口）、`80`、`443` 和宝塔管理端口。
3. 不要向公网开放 `3000`、`8000`、`3306`。
4. 将代码上传或拉取到 `/www/wwwroot/ClawTree`。

建议权限：

```bash
cd /www/wwwroot
chown -R www:www ClawTree
chmod 755 ClawTree ClawTree/frontend ClawTree/backend
```

不要在不清楚现有权限用途时批量覆盖全部文件权限，以免清除脚本的可执行位。`.env`、私钥、数据库备份应单独使用更严格权限。

## 4. 创建 MySQL 数据库

在宝塔“数据库”中新建：

- 数据库名：`clawtree`
- 用户名：例如 `clawtree_app`
- 字符集：`utf8mb4`
- 访问权限：仅本机 `127.0.0.1`
- 密码：使用随机强密码

生产环境不能使用 MySQL `root` 用户。当前后端在 `DJANGO_DEBUG=false` 时会主动拒绝 `MYSQL_USER=root`。

如需手工授权，权限应限制在 ClawTree 自己的数据库：

```sql
CREATE DATABASE clawtree CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'clawtree_app'@'127.0.0.1' IDENTIFIED BY '替换为强密码';
GRANT ALL PRIVILEGES ON clawtree.* TO 'clawtree_app'@'127.0.0.1';
FLUSH PRIVILEGES;
```

## 5. 配置生产环境变量

### 5.1 后端根环境文件

从模板创建，不要把生产密钥提交进 Git：

```bash
cd /www/wwwroot/ClawTree
cp .env.example .env
chmod 600 .env
```

用宝塔文件编辑器或终端编辑 `.env`：

```dotenv
DJANGO_DEBUG=false
DJANGO_SECRET_KEY=替换为至少50位的随机密钥
DJANGO_ALLOWED_HOSTS=example.com,www.example.com,ops.example.com,127.0.0.1

DATABASE_ENGINE=mysql
MYSQL_DATABASE=clawtree
MYSQL_HOST=127.0.0.1
MYSQL_USER=clawtree_app
MYSQL_PASSWORD=替换为数据库强密码
MYSQL_PORT=3306

# 不需要真实邮件发送时留空，系统会使用 console backend。
SMTP_HOST=
SMTP_PORT=465
SMTP_USE_SSL=true
SMTP_USER=
SMTP_PASS=
DEFAULT_FROM_EMAIL=

# 可选：后端结构化 Agent。没有密钥时使用确定性 fallback。
CLAWTREE_AGENT_PROVIDER=zhipu
ZHIPU_API_KEY=
ZHIPU_BASE_URL=https://open.bigmodel.cn/api/paas/v4
ZHIPU_MODEL=glm-4.7

# 可选采集连接器
TWITTER_API_KEY=
XAI_API_KEY=
UNIVERSITY_SEARCH_KEYWORDS=
```

生成 Django 密钥的一种方式：

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(64))"
```

### 5.2 前端环境文件

创建 `frontend/.env.production.local`：

```bash
cd /www/wwwroot/ClawTree/frontend
cp .env.example .env.production.local
chmod 600 .env.production.local
```

至少增加：

```dotenv
NEXT_PUBLIC_API_URL=https://example.com/api
NEXT_PUBLIC_WORKSPACE_SLUG=treefinance

# 无模型密钥也可以演示确定性 RAG fallback。
ASSISTANT_FORCE_FALLBACK=0
ASSISTANT_ENABLE_WEB_SEARCH=1

DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat

ZHIPU_API_KEY=
ZHIPU_BASE_URL=https://open.bigmodel.cn/api/paas/v4
ZHIPU_WEB_MODEL=glm-4.7
ZHIPU_WEB_SEARCH_ENGINE=search_pro
ZHIPU_WEB_ENABLE_READER=1

DASHSCOPE_API_KEY=
QWEN_BASE_URL=https://dashscope.aliyuncs.com
QWEN_WEB_SEARCH_MODEL=qwen-plus
QWEN_WEB_SCRAPE_MODEL=qwen3.5-plus
QWEN_WEB_ENABLE_SCRAPING=1
```

这里建议把 `NEXT_PUBLIC_API_URL` 写成完整 HTTPS 地址，而不是服务器 IP、`127.0.0.1` 或仅 `/api`。浏览器中的 `127.0.0.1` 指的是访问者自己的电脑；此外，当前 ingestion 页面用完整 API 地址更可靠。

`NEXT_PUBLIC_*` 会在构建时写入前端产物。修改域名或这些变量后，必须重新执行 `npm run build`，再重启 PM2。

服务器上如果已经存在带真实密钥的 `.env` 文件，部署前应确认它未被提交，并轮换曾在聊天、日志、截图或公开环境中暴露过的密钥。

## 6. 安装和初始化 Django 后端

初始化环境
```
cd /www/wwwroot/ClawTree/backend
rm -rf .venv

which python3
python3 --version
ls -l "$(which python3)"

apt update
apt install -y python3-venv python3-pip

# If it's python3.12
apt install -y python3.12-venv
```

```bash
cd /www/wwwroot/ClawTree/backend
python3 -m venv .venv
source .venv/bin/activate
./.venv/bin/python -m pip install --upgrade pip setuptools wheel
./.venv/bin/pip install -r requirements.txt
./.venv/bin/pip install gunicorn
```

当前 `backend/requirements.txt` 没有包含 Gunicorn，因此生产服务器必须额外安装。后续建议将 Gunicorn 固定版本加入依赖锁定流程。

运行生产检查、迁移和静态文件收集。`manage.py` 会读取仓库根 `.env`：

```bash
cd /www/wwwroot/ClawTree/backend
./.venv/bin/python manage.py check
./.venv/bin/python manage.py check --deploy
./.venv/bin/python manage.py migrate --noinput
./.venv/bin/python manage.py collectstatic --noinput
```

`check --deploy` 针对当前代码可能提示 HTTPS 安全设置尚未启用，参见本文“生产安全设置”章节。先处理高风险项再正式开放服务。

如需要 Django 超级管理员：

```bash
./.venv/bin/python manage.py createsuperuser
```

不要默认在正式数据库运行 `seed_events`，它用于演示/初始化样例数据。只有确认需要比赛演示数据时才执行：

```bash
./.venv/bin/python manage.py seed_events
```

## 7. 用 Supervisor 启动 Django + Gunicorn

### 7.1 环境变量加载陷阱

`backend/manage.py` 会加载 `.env`，但 Gunicorn 直接导入 `config.wsgi`，不会经过 `manage.py`。因此，仅在磁盘上创建 `.env` 不足以让 Supervisor 中的 Gunicorn 获得环境变量。

推荐在 Supervisor 命令中显式加载 `.env`：

```bash
/bin/bash -lc 'set -a; source /www/wwwroot/ClawTree/.env; set +a; exec /www/wwwroot/ClawTree/backend/.venv/bin/gunicorn config.wsgi:application --bind 127.0.0.1:8000 --workers 3 --threads 2 --timeout 120 --access-logfile - --error-logfile -'
```

`.env` 中的值如果含空格、`#`、引号或 shell 特殊字符，必须正确引用，例如：

```dotenv
DJANGO_SECRET_KEY='包含特殊字符的完整值'
MYSQL_PASSWORD='包含特殊字符的完整值'
```

### 7.2 宝塔 Supervisor 配置

在“Supervisor 管理器 → 添加守护进程”中填写：

- 名称：`clawtree-backend`
- 运行目录：`/www/wwwroot/ClawTree/backend`
- 启动用户：`www`
- 启动命令：使用上一节完整命令
- 进程数量：`1`（Gunicorn 自己管理 workers）
- 自动启动：开启
- 自动重启：开启

如直接编辑 Supervisor 配置，可参考：

```ini
[program:clawtree-backend]
directory=/www/wwwroot/ClawTree/backend
command=/bin/bash -lc 'set -a; source /www/wwwroot/ClawTree/.env; set +a; exec /www/wwwroot/ClawTree/backend/.venv/bin/gunicorn config.wsgi:application --bind 127.0.0.1:8000 --workers 3 --threads 2 --timeout 120 --access-logfile - --error-logfile -'
user=www
autostart=true
autorestart=true
startsecs=5
stopasgroup=true
killasgroup=true
environment=PYTHONUNBUFFERED="1"
stdout_logfile=/www/wwwlogs/clawtree-backend.log
stdout_logfile_maxbytes=50MB
stdout_logfile_backups=10
redirect_stderr=true
```

启动后验证：

```bash
curl -i http://127.0.0.1:8000/api/events/
```

看到 JSON 或正常的 DRF 响应，说明 Gunicorn 已启动。若失败，先查看 `/www/wwwlogs/clawtree-backend.log`。

## 8. 构建并用 PM2 启动 Next.js

```bash
cd /www/wwwroot/ClawTree/frontend
npm ci
npm run lint
npm run typecheck
npm run build
```

生产环境不要运行 `npm run dev` 或仓库根目录的 `npm run demo`。

启动 PM2：

```bash
pm2 delete clawtree-frontend 2>/dev/null || true
pm2 start npm --name clawtree-frontend --cwd /www/wwwroot/ClawTree/frontend -- start -- --hostname 127.0.0.1 --port 3000
pm2 save
```

确保使用与宝塔开机启动服务相同的 Linux 用户执行 PM2 命令，否则会出现“命令行能看到进程，但宝塔看不到”或重启后进程丢失。

如果宝塔 PM2 插件未负责开机恢复，可按 `pm2 startup` 输出的命令配置，并再次执行：

```bash
pm2 save
```

启动后验证：

```bash
pm2 status
pm2 logs clawtree-frontend --lines 100
curl -fsS http://127.0.0.1:3000/api/health
```

健康接口应返回包含 `"status":"ok"` 的 JSON。

建议安装 PM2 日志轮转：

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 10
pm2 save
```

## 9. 宝塔 Nginx 主站配置

在宝塔“网站 → 添加站点”创建 `example.com` 和 `www.example.com`。站点根目录可以指向项目目录，但不要开启 PHP。

以下配置最重要的部分是 API 分流顺序。当前项目的 Next.js 和 Django 都使用 `/api/`，不能将所有 `/api/` 无差别转给同一个进程。

### 9.1 API 分流原则

| 路径 | 上游 | 用途 |
| --- | --- | --- |
| `/api/health` | Next.js `3000` | 前端健康检查 |
| `/api/assistant/*` | Next.js `3000` | AI 助手 |
| `/api/demo`、`/api/demo/*` | Next.js `3000` | 黑客松确定性演示 |
| `/api/events/ai-filter` | Next.js `3000` | 前端 AI 筛选 Route Handler |
| `/api/outreach/draft` | Next.js `3000` | 演示草稿接口 |
| `/api/outreach/approve` | Next.js `3000` | 演示审批接口 |
| `/api/proofs/anchor` | Next.js `3000` | 隐私安全的演示存证接口 |
| 其他 `/api/*` | Django `8000` | 实时业务数据、后台 Agent、审核与外联 |
| `/` | Next.js `3000` | 页面与前端静态资源 |

`/api/events`、`/api/events/stats` 和 `/api/user/*` 在前后端都有实现。推荐的“真实后端模式”让它们进入 Django；Next.js 中同名接口作为无数据库演示 fallback 保留。

### 9.2 可复制的主站配置

在宝塔站点配置中保留 SSL 证书相关内容，并将 server 的业务部分调整为：

```nginx
server {
    listen 80;
    listen 443 ssl http2;
    server_name example.com www.example.com;

    # 宝塔申请证书后会生成 ssl_certificate 等配置，保留宝塔生成内容。

    client_max_body_size 20m;

    # Django collectstatic 输出。必须以 / 结尾。
    location /static/ {
        alias /www/wwwroot/ClawTree/backend/staticfiles/;
        expires 7d;
        access_log off;
    }

    # Next.js 专属 API：必须放在通用 /api/ 之前。
    location = /api/health {
        proxy_pass http://127.0.0.1:3000;
        include proxy_params;
    }

    location = /api/demo {
        proxy_pass http://127.0.0.1:3000;
        include proxy_params;
    }

    location ^~ /api/demo/ {
        proxy_pass http://127.0.0.1:3000;
        include proxy_params;
        proxy_read_timeout 120s;
    }

    location ^~ /api/assistant/ {
        proxy_pass http://127.0.0.1:3000;
        include proxy_params;
        proxy_read_timeout 180s;
        proxy_send_timeout 180s;
        proxy_buffering off;
    }

    location = /api/events/ai-filter {
        proxy_pass http://127.0.0.1:3000;
        include proxy_params;
        proxy_read_timeout 180s;
    }

    location = /api/outreach/draft {
        proxy_pass http://127.0.0.1:3000;
        include proxy_params;
    }

    location = /api/outreach/approve {
        proxy_pass http://127.0.0.1:3000;
        include proxy_params;
    }

    location = /api/proofs/anchor {
        proxy_pass http://127.0.0.1:3000;
        include proxy_params;
    }

    # 真实 Django REST API。
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 180s;
        proxy_send_timeout 180s;
    }

    # Next.js 页面、/_next/ 静态资源和其他 Route Handler。
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 180s;
    }
}
```

如果服务器的 Nginx 没有 `/etc/nginx/proxy_params`，或者宝塔 Nginx 的 `include proxy_params;` 报错，请把这些 `include proxy_params;` 替换为：

```nginx
proxy_http_version 1.1;
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```

保存前测试：

```bash
nginx -t
```

测试通过后再在宝塔中重载 Nginx。

## 10. Django Admin：推荐独立运维子域

Next.js 已经使用 `/admin` 作为 ClawTree 运营台，而 Django 默认也使用 `/admin/`。最稳定的方案是给 Django Admin 使用独立域名，例如 `ops.example.com`，不要在同一主域上强行改写 `/django-admin/`。

在宝塔新建 `ops.example.com` 站点，申请 HTTPS 证书，然后配置：

```nginx
server {
    listen 80;
    listen 443 ssl http2;
    server_name ops.example.com;

    # 保留宝塔生成的 SSL 配置。

    location /static/ {
        alias /www/wwwroot/ClawTree/backend/staticfiles/;
        expires 7d;
        access_log off;
    }

    location = / {
        return 302 /admin/;
    }

    location /admin/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 运维子域不对外提供其他 Django API。
    location / {
        return 404;
    }
}
```

Django Admin 地址为：

```text
https://ops.example.com/admin/
```

建议再使用宝塔访问限制、Nginx Basic Auth、VPN 或固定 IP 白名单保护该子域。不要只依赖 Django 登录页。

当前 `frontend/app/admin/page.tsx` 中的 Django Admin 链接硬编码为 `http://127.0.0.1:8000/admin/`，线上浏览器点击会指向访问者自己的电脑。部署完成后应将该链接改成环境化的 `https://ops.example.com/admin/`；在修改代码前，请直接访问上述运维子域。

## 11. HTTPS 与生产安全设置

### 11.1 宝塔 SSL

在每个站点的“SSL”页面申请 Let's Encrypt 证书，并开启“强制 HTTPS”。确认自动续期任务正常。

外部验证：

```bash
curl -I http://example.com
curl -I https://example.com
```

HTTP 应跳转到 HTTPS，HTTPS 证书域名和有效期应正确。

### 11.2 Django 反向代理安全设置

当前 `backend/config/settings.py` 尚未完整环境化 HTTPS/CSRF 配置。正式对外服务前，建议在代码中增加：

```python
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

CSRF_TRUSTED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get('DJANGO_CSRF_TRUSTED_ORIGINS', '').split(',')
    if origin.strip()
]

CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get('DJANGO_CORS_ALLOWED_ORIGINS', '').split(',')
    if origin.strip()
]

SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
SECURE_CONTENT_TYPE_NOSNIFF = True
```

并在 `.env` 添加：

```dotenv
DJANGO_CSRF_TRUSTED_ORIGINS=https://example.com,https://www.example.com,https://ops.example.com
DJANGO_CORS_ALLOWED_ORIGINS=https://example.com,https://www.example.com
```

主站使用同域 `/api` 反代时通常不需要 CORS，但 HTTPS 下的 Django Admin、Session/CSRF 和未来跨域客户端仍应正确配置。修改后重启 Supervisor。

其他安全要求：

- `DJANGO_DEBUG` 必须为 `false`；
- `.env` 权限设为 `600`，不得提交到 Git；
- LLM、SMTP、数据库、钱包私钥不得使用 `NEXT_PUBLIC_` 前缀；
- 生产钱包使用低余额专用账户，不要使用主资产钱包；
- 只将隐私安全的哈希/公开摘要上链，不要上传联系人、邮件正文、回复、Prompt 或私钥；
- 定期运行仓库密钥扫描：`npm run secret:scan`。

## 12. 配置定时采集任务（可选）

仓库的 `backend/deploy/crontab` 使用了 `/opt/clawtree` 示例路径，不能原样复制到宝塔服务器。

推荐使用宝塔“计划任务 → Shell 脚本”。例如每天 07:30 执行 Content Relay：

```bash
#!/bin/bash
set -e
set -a
source /www/wwwroot/ClawTree/.env
set +a
cd /www/wwwroot/ClawTree/backend
exec /www/wwwroot/ClawTree/backend/.venv/bin/python manage.py run_content_relay --fixture /www/wwwroot/ClawTree/frontend/data/golden-gate.json >> /www/wwwlogs/clawtree-cron-content-relay.log 2>&1
```

每天 08:00、18:00 采集活动：

```bash
#!/bin/bash
set -e
set -a
source /www/wwwroot/ClawTree/.env
set +a
cd /www/wwwroot/ClawTree/backend
exec /www/wwwroot/ClawTree/backend/.venv/bin/python manage.py fetch_events >> /www/wwwlogs/clawtree-cron-events.log 2>&1
```

不要使用 `export $(cat .env | xargs)` 加载生产密钥，它不能安全处理空格、`#` 和其他特殊字符。

## 13. 首次上线验证清单

### 13.1 内网进程

```bash
curl -fsS http://127.0.0.1:3000/api/health
curl -i http://127.0.0.1:8000/api/events/
pm2 status
supervisorctl status
```

### 13.2 公网路由

```bash
curl -fsS https://example.com/api/health
curl -fsS https://example.com/api/demo
curl -i https://example.com/api/events/
curl -i -X POST https://example.com/api/events/ai-filter \
  -H 'Content-Type: application/json' \
  -d '{}'
curl -I https://example.com/static/admin/css/base.css
```

浏览器逐项检查：

- `/` 首页；
- `/demo` 三分钟演示；
- `/user` 用户门户；
- `/admin` Next.js 运营台；
- AI 助手对话；
- 活动列表和统计是否来自 Django；
- `https://ops.example.com/admin/` Django Admin；
- 管理后台 CSS、登录、POST 操作；
- 移动端布局与 HTTPS 锁标志。

### 13.3 重启恢复

在比赛前安排一次维护窗口重启服务器，确认：

- Nginx 自动启动；
- MySQL 自动启动；
- Supervisor 自动恢复 Django；
- PM2 自动恢复 Next.js；
- HTTPS 证书仍正常；
- 所有验证 URL 仍能访问。

这一步非常重要，不能只看到 PM2/Supervisor 当前显示“运行中”就认为开机自启已经生效。

## 14. 日常更新发布

更新前先备份数据库和生产环境变量，然后拉取指定的、已测试的提交。

```bash
cd /www/wwwroot/ClawTree
git status
git pull --ff-only
```

后端更新：

```bash
cd /www/wwwroot/ClawTree/backend
./.venv/bin/pip install -r requirements.txt
./.venv/bin/pip install gunicorn
./.venv/bin/python manage.py migrate --noinput
./.venv/bin/python manage.py collectstatic --noinput
supervisorctl restart clawtree-backend
```

前端更新：

```bash
cd /www/wwwroot/ClawTree/frontend
npm ci
npm run lint
npm run typecheck
npm run build
pm2 restart clawtree-frontend --update-env
pm2 save
```

最后重复“首次上线验证清单”。不要在旧 Next.js 进程运行时删除 `.next` 后长时间不构建；应尽量缩短构建与切换窗口。

## 15. 备份与回滚

至少备份：

- MySQL `clawtree` 数据库；
- `/www/wwwroot/ClawTree/.env`；
- `frontend/.env.production.local`；
- 用户上传文件和 `backend/data/` 中需要保留的运行数据；
- 当前成功上线的 Git commit ID；
- Nginx、Supervisor 配置。

推荐宝塔每天增量备份、每周全量备份，并将加密备份同步到另一台机器或对象存储。必须定期做恢复演练。

代码回滚示例：切回上一个已验证 commit，重新安装依赖、构建并重启。数据库 migration 不一定能仅靠切回代码恢复，所以数据库变更前必须先备份，并为不可逆迁移准备单独回滚方案。

## 16. 常见故障

### 页面显示 502 Bad Gateway

```bash
pm2 status
pm2 logs clawtree-frontend --lines 200
supervisorctl status
tail -n 200 /www/wwwlogs/clawtree-backend.log
tail -n 200 /www/wwwlogs/error.log
```

检查 PM2 是否监听 `127.0.0.1:3000`、Gunicorn 是否监听 `127.0.0.1:8000`。

### `/api/assistant`、`/api/proofs/anchor` 或 AI 筛选返回 404

Nginx 将 Next.js 专属 Route Handler 错误送到了 Django。检查精确 location 是否位于通用 `/api/` 分流之前，并执行 `nginx -t` 后重载。

### 数据页面显示演示 fixture，而不是真实数据库

确认 `/api/events/`、`/api/events/stats/`、`/api/user/*` 被代理到 `8000`，并确认 `NEXT_PUBLIC_API_URL=https://example.com/api` 在构建前已写入。

### 浏览器请求 `127.0.0.1:8000` 失败

线上前端不能访问服务器的 `127.0.0.1`。将 `NEXT_PUBLIC_API_URL` 改为公网 HTTPS API 地址，重新构建并重启 PM2。Django Admin 的当前硬编码链接也需按本文说明修改或直接访问运维子域。

### Supervisor 中 Django 启动失败，但 `manage.py` 命令正常

通常是 Gunicorn 没有加载根 `.env`。确认 Supervisor 使用了 `set -a; source .../.env; set +a`，并检查运行用户是否有权读取 `.env`。

### Django Admin 没有 CSS

重新执行：

```bash
cd /www/wwwroot/ClawTree/backend
./.venv/bin/python manage.py collectstatic --noinput
```

检查 Nginx `/static/` alias 的目录、尾部 `/` 和文件读取权限。

### MySQL 安装依赖失败

确认安装了编译器、Python 开发头、`pkg-config` 和 MySQL client 开发库，然后在虚拟环境中重新安装 `mysqlclient`。

### HTTPS 下 Django 登录/POST 出现 CSRF 错误

检查 `X-Forwarded-Proto`、`SECURE_PROXY_SSL_HEADER`、`CSRF_TRUSTED_ORIGINS`、域名和协议是否完全一致，然后重启 Supervisor。

## 17. 比赛演示前的最后建议

1. 保留确定性 fallback，避免模型供应商限流导致演示中断；
2. 同时准备真实后端数据和 `/demo` 黄金路径；
3. 提前预热首页、Demo、用户端、运营台和 AI 助手；
4. 在手机热点环境下完整走一次演示；
5. 录制一份本地备份视频，但现场优先展示真实系统；
6. 演示账户、钱包和邮箱都使用低权限专用账户；
7. 比赛当天不要升级 Node、Python、MySQL 或执行未验证的 migration；
8. 开场前再次检查 PM2、Supervisor、SSL、数据库、模型额度和链上测试网余额。

完成以上步骤后，ClawTree 的公网请求链路应为：

```text
用户浏览器
  -> HTTPS / 宝塔 Nginx
      -> Next.js + PM2 (127.0.0.1:3000)
      -> Django + Gunicorn + Supervisor (127.0.0.1:8000)
          -> MySQL 8 (127.0.0.1:3306)
```
