# suffer-gateway

独立 Go 通用 HTTP 转发 API，部署在能访问公网的 ECS。K8s 通过 ECS 内网调用，不需要网关鉴权。不依赖数据库、Redis 或其他 Phoenix 模块。

## 接口

`POST http://ECS内网IP:18080/forward`，外层请求使用 `Content-Type: application/json`。

```json
{
  "url": "https://provider888.com/api/v2",
  "method": "POST",
  "headers": {
    "Content-Type": "application/x-www-form-urlencoded"
  },
  "body": "key=YOUR_PLATFORM_KEY&action=balance",
  "timeout_ms": 15000
}
```

每次独立传目标 URL，不需要修改网关配置或重新部署。

| 参数 | 说明 |
| --- | --- |
| `url` | 必填，完整 HTTP/HTTPS URL，含路径及 query；不允许 URL 用户名密码或 fragment |
| `method` | 必填，GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS/TRACE/自定义 UPDATE 等；小写转换为大写，不支持 CONNECT 隧道 |
| `headers` | 可选，值为字符串或字符串数组；如 `{"Authorization":"Bearer xxx","X-Tag":["a","b"]}` |
| `body` | 可选。字符串按解码后的文本发送；对象、数组、数字、布尔值、null 按 JSON 原文发送。不传表示空请求体，`null` 表示发送文本 `null` |
| `body_encoding` | 可选，`text`（默认）或 `base64`；base64 时 body 必须是 Base64 字符串，解码为字节后发送 |
| `timeout_ms` | 可选，0/省略采用服务默认超时；覆盖连接、TLS、响应头和完整响应体读取。不能超过服务配置上限 |

普通 JSON body 若未传 Content-Type 自动设为 `application/json`；字符串 body 的 Content-Type 由调用方指定。表单中的字段值应先 URL 编码，不能直接拼接未编码的链接或 key。multipart 可以将完整 multipart 字节 Base64 编码，Content-Type 中指定对应 boundary。

HTTP Host/TLS SNI 由 url 确定，Content-Length 由实际请求体计算，这两个 header 参数不会覆盖它们。逐跳头（Connection、Transfer-Encoding 等）按 HTTP 规范移除。外层请求的 headers 不会自动带给目标，平台鉴权请显式放在参数 headers/body 中。

### 返回结果

完整收到目标响应时，网关返回 HTTP 200：

```json
{
  "request_id": "...",
  "status_code": 200,
  "headers": {"Content-Type": ["application/json"]},
  "body": "{\"balance\":\"10.00\",\"currency\":\"USD\"}",
  "body_encoding": "text"
}
```

`status_code` 是目标的真实 HTTP 状态，目标 400/500 也放在此字段，不能只凭外层 HTTP 200 判断业务成功。headers 的值统一为数组，保留多值 Set-Cookie 等；body 是字符串，若目标返回 JSON，调用方再次解析 body。非 UTF-8 响应自动返回 Base64，调用方根据 body_encoding 解码可还原原始字节；UTF-8 字节返回 text。显式请求 gzip 等压缩时，压缩字节不会自动解压，需要调用方依据目标 Content-Encoding 处理。

网关参数错误返回 400，请求 JSON 超限返回 413，公网连接/读取错误或响应体超限返回 502，公网请求超时返回 504：

```json
{"request_id":"...","error":"upstream_timeout","message":"upstream request failed; acceptance of a write request is unknown"}
```

不主动跟随 3xx，状态及 Location 返回给调用方。不做业务重试；下单超时不等于平台未受理，重试前先查平台记录。接口会在大小限制内缓冲完整请求/响应，适用于 API、有限大小文件，不用于 SSE、WebSocket、无限流或 CONNECT。

## 调用示例

```bash
# GET：query 直接写在 url 中
curl http://127.0.0.1:18080/forward \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://httpbin.org/get?a=1&a=2","method":"GET"}'

# JSON POST：body 直接写对象
curl http://127.0.0.1:18080/forward \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://httpbin.org/post","method":"POST","headers":{"Content-Type":"application/json"},"body":{"name":"demo","count":10}}'

# PUT / PATCH / DELETE / UPDATE：改变 method，其余参数用法相同
curl http://127.0.0.1:18080/forward \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://httpbin.org/delete","method":"DELETE","headers":{"Authorization":"Bearer PLATFORM_TOKEN"}}'
```

## 构建和 ECS 部署

### 一键脚本（推荐）

| 脚本 | 执行位置 | 用途 |
| --- | --- | --- |
| `./build.sh [amd64\|arm64]` | 开发机/构建机 | 先测试、vet，再交叉编译并生成 Linux 部署压缩包，默认 amd64 |
| `./deploy.sh [配置文件]` | ECS 解压目录 | 安装 systemd 服务、更新程序、启动并健康检查；升级保留已有配置，失败恢复旧程序/服务文件 |
| `./start.sh` | ECS | 启动并检查健康状态，已启动时不重复创建进程 |
| `./stop.sh` | ECS | 通过 systemd 停止，不影响其他 Go 进程，不取消开机启动 |

开发机打包并上传（替换 SSH 用户、ECS 地址）：

```bash
cd phoenix/server/suffer-gateway
./build.sh amd64
scp dist/suffer-gateway-linux-amd64.tar.gz USER@ECS:/tmp/
```

首次在 ECS 上部署：

```bash
mkdir -p ~/suffer-gateway-release
tar -xzf /tmp/suffer-gateway-linux-amd64.tar.gz -C ~/suffer-gateway-release
cd ~/suffer-gateway-release/suffer-gateway-linux-amd64
cp config.example.json config.json
vi config.json
# 将 listen 改为 ECS 实际内网 IP:18080
./deploy.sh ./config.json
```

ECS 需要 Bash、systemd、curl、flock（util-linux），部署账号需 root 或 sudo 权限，无需安装 Go。升级上传新包、解压后直接执行 `./deploy.sh`。`/etc/suffer-gateway/config.json` 已存在时始终保留，即便传入另一个配置也不会覆盖。部署前会执行新程序的 `-check-config`；架构错误或配置错误不会停止旧服务。更新时有短暂重启窗口；健康检查失败会恢复旧二进制与旧 unit，旧服务原本运行才会重新启动。首次部署失败则服务保持停止，文件保留供排查。备份保存在 `/opt/suffer-gateway/backups/`，不自动清理。

部署后管理：

```bash
sudo /opt/suffer-gateway/start.sh
sudo /opt/suffer-gateway/stop.sh
sudo journalctl -u suffer-gateway.service -f
# 修改已安装配置后：
sudo /opt/suffer-gateway/suffer-gateway -config /etc/suffer-gateway/config.json -check-config
sudo /opt/suffer-gateway/stop.sh
sudo /opt/suffer-gateway/start.sh
```

`-check-config` 只校验并打印监听地址，不启动服务，不请求公网。健康检查仅检查进程，不会向 provider888 下单。

### 手动构建与安装

需要 Go 1.21+，建议用仍受支持的最新稳定 Go 构建。

```bash
cd phoenix/server/suffer-gateway
cp config.example.json config.json
go run . -config config.json
curl http://127.0.0.1:18080/healthz

go test -race ./...
go vet ./...
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -o dist/suffer-gateway .
# ARM ECS 将 GOARCH 改为 arm64
```

配置示例默认监听本机；ECS 将 listen 改为实际内网 IP，例如：

```json
{
  "listen": "172.16.1.10:18080",
  "connect_timeout_seconds": 10,
  "request_timeout_seconds": 60,
  "max_request_bytes": 16777216,
  "max_response_bytes": 33554432
}
```

请求大小限制针对完整外层 JSON（Base64 本身也占容量）；响应大小限制针对上游原始字节，JSON/Base64 包装后会更大。配置变化需重启。公网访问直接使用 ECS 网络，不读取 HTTP_PROXY/HTTPS_PROXY。服务不限制目标域名、不做应用层鉴权，部署时监听内网地址，安全组允许 K8s 实际来源访问该端口。

上传二进制、config.example.json 和 suffer-gateway.service 至 ECS，在上传目录执行：

```bash
sudo useradd --system --no-create-home --shell /sbin/nologin suffer-gateway
sudo install -d /opt/suffer-gateway /etc/suffer-gateway
sudo install -m 0755 suffer-gateway /opt/suffer-gateway/suffer-gateway
sudo install -m 0644 config.example.json /etc/suffer-gateway/config.json
sudo vi /etc/suffer-gateway/config.json
sudo install -m 0644 suffer-gateway.service /etc/systemd/system/suffer-gateway.service
sudo systemctl daemon-reload
sudo systemctl enable --now suffer-gateway
sudo journalctl -u suffer-gateway -f
```

已有用户则跳过 useradd。启动/失败日志不打印 URL 查询参数、请求体、鉴权 header。返回 X-Suffer-Request-ID 及 JSON request_id 用于关联日志。健康检查只代表进程存活，不代表公网目标可达。SIGTERM/SIGINT 最多等待 30 秒完成在途请求。

## Barry 接入说明

这版是通用 JSON 转发 API，已替换最初的固定路由反向代理设计。不能仅将 channel_gateway_config.api_url 改成 `/forward` 就直接使用：Barry 需要将原目标 URL、POST 方法、Content-Type 以及表单正文封装成上述 JSON，发送到网关，再检查外层 HTTP 状态、响应 status_code 并解析 body。原 api_url 应保留公网平台 URL，网关地址应另外配置。

本次只实现通用服务，尚未修改 Barry 的 PanelAdapter。其 add/status/cancel 等调用接入网关后，都可以共用同一转发接口。调用方的 HTTP 超时应略大于 timeout_ms，避免网关尚未返回就被调用方提前断开。
