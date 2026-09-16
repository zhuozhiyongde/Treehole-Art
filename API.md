# 北大树洞 Web API 静态整理

> 本文档根据当前目录中的旧版 Web 前端打包代码静态还原，不是官方 API 文档，也未对线上接口发起验证请求。无版本号的路径、字段和限流策略都可能变化。
>
> 文中标为“新版 `/chapi`”的接口来自当前官方 `/ch/` 前端产物及其实际调用方式。它们是官方页面正在使用的内部接口，但仍不等同于校方对外发布、承诺兼容性的公开 API。

## 1. 基础约定

- API 基址：`https://treehole.pku.edu.cn/api`
- 在树洞页面内请求时可使用同源相对路径 `/api/*`。
- 普通响应为 JSON；图片接口返回 Blob。
- 原前端请求超时时间为 300 秒。
- 除公开登录流程外，请求通常需要 Token 和设备 UUID。

### 1.1 认证请求头

```http
Authorization: Bearer <pku_token>
Uuid: Web_PKUHOLE_2.0.0_WEB_UUID_<uuid>
```

- Token 来自 Cookie `pku_token`。原页面通过 JavaScript 读取该 Cookie，因此存档版中它不是 HttpOnly Cookie。
- UUID 来自 `localStorage["pku-uuid"]`。
- UUID 不存在时，原前端生成 UUID 并加上 `Web_PKUHOLE_2.0.0_WEB_UUID_` 前缀。
- 不要把 Token 复制到用户脚本日志、DOM 属性或 GM 持久化存储中。

### 1.2 请求封装示例

```js
function readCookie(name) {
  const prefix = `${encodeURIComponent(name)}=`;
  const item = document.cookie
    .split("; ")
    .find((part) => part.startsWith(prefix));
  return item ? decodeURIComponent(item.slice(prefix.length)) : "";
}

function getDeviceUuid() {
  let uuid = localStorage.getItem("pku-uuid");
  if (!uuid) {
    uuid = `Web_PKUHOLE_2.0.0_WEB_UUID_${crypto.randomUUID()}`;
    localStorage.setItem("pku-uuid", uuid);
  }
  return uuid;
}

async function treeholeApi(path, options = {}) {
  const headers = new Headers(options.headers);
  const token = readCookie("pku_token");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  headers.set("Uuid", getDeviceUuid());

  // FormData 请求不要手动设置 Content-Type/boundary。
  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`/api${path}`, {
    ...options,
    headers,
    credentials: "same-origin",
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
```

### 1.3 新版 `/chapi` 请求约定

当前官方 `/ch/` 页面使用另一组同源接口，基址为：

```text
/chapi/api/v3
```

本项目中的悬赏发布和最佳答案操作使用这组接口。常见请求头如下：

```http
Authorization: Bearer <token>
Uuid: Web_PKUHOLE_2.0.0_WEB_UUID_<uuid>
userAgent: pku_web
X-XSRF-TOKEN: <XSRF-TOKEN cookie，可选>
Content-Type: application/json
```

- Token 优先读取 `localStorage["token"]`，没有时回退到 Cookie `pku_token`。
- `X-XSRF-TOKEN` 来自 Cookie `XSRF-TOKEN`；不存在时不发送。
- 请求携带 `credentials: "same-origin"`。
- JSON 响应仍使用统一信封结构；当前客户端将 `success === false`，或存在且不等于 `20000` 的 `code` 视为业务失败。
- 本地 `localhost`/`127.0.0.1` 预览不会调用线上接口，而是使用项目中的 Mock 数据。

## 2. 统一响应

常见 JSON 响应外形：

```ts
interface ApiResponse<T> {
  success: boolean;
  code?: number;
  message?: string;
  data: T;
}

interface Paginated<T> {
  data: T[];
  total: number;
  last_page: number;
  // 后端可能还会返回 Laravel paginator 的其他字段。
}
```

前端特别处理的业务状态码：

| `code` | 原前端行为 |
| --- | --- |
| `40002` | 替换路由为 `/verification` |
| `40008` | 跳转 `/verification_user` |
| `40088` | 跳转 `/verification_user?type=1` |
| `40009` | 跳转 `/verification_slide_h5?computer=1` |
| `40099` | 跳转 `/verification_slide_h5?type=1&computer=1` |
| `40010` | 跳转 `/agreement?computer=1` |
| HTTP `401` | 重新进入 IAAA 登录 |

重构客户端时必须在解析普通业务数据前先处理这些状态。

## 3. 数据模型

以下字段来自页面的实际读取点，并非后端的完整 Schema。

```ts
interface Hole {
  pid: number;
  text: string;
  type: "text" | "image";
  kind?: 0 | 1;                // 新版：0 普通树洞，1 悬赏树洞
  reward_cost?: number;        // 新版：悬赏树叶数
  has_reward_good?: 0 | 1;     // 新版：是否已经指定最佳答案
  islz?: 0 | 1;                // 新版：当前用户是否为洞主
  timestamp: number;            // Unix 秒
  likenum: number;
  reply: number;
  is_follow: 0 | 1;
  is_top?: 0 | 1;
  label_info?: { id: number; tag_name: string };
  tag?: string;
  bookmark?: {
    bookmark?: { id: number; bookmark_name: string };
  };
  children_pid?: number;
}

interface Comment {
  cid: number;
  pid: number;
  text: string;
  name?: string;
  timestamp: number;
  quote?: { name_tag: string; text: string };
  type?: "text" | "image";
  likenum?: number;
  is_follow?: 0 | 1;
  reward_good?: 0 | 1;         // 新版：是否为悬赏最佳答案
  is_lz?: 0 | 1;               // 新版：该回复是否由洞主发布
}
```

`block`、`show`、`children`、`color` 和图片 `url` 是存档版前端在本地补充的状态，不应默认它们来自 API。

## 4. 信息流与搜索

### `GET /pku_hole`

获取公开信息流、搜索结果或指定 PID。

| Query | 类型 | 说明 |
| --- | --- | --- |
| `page` | number | 页码，列表首页为 `1` |
| `limit` | number | 每页数量，原信息流使用 `25` |
| `keyword` | string | 单个服务端搜索词 |
| `pid` | number/string | 指定洞号，与 `keyword` 二选一 |
| `label` | number/string | 标签 ID |

响应：`ApiResponse<Paginated<Hole>>`。

```js
const query = new URLSearchParams({ page: "1", limit: "25", keyword: "机器学习" });
const result = await treeholeApi(`/pku_hole?${query}`);
```

### `GET /follow_v2`

获取已关注的洞。支持 `/pku_hole` 的列表参数，额外支持：

| Query | 类型 | 说明 |
| --- | --- | --- |
| `bookmark_id` | number/string | 收藏分组 ID |

响应：`ApiResponse<Paginated<Hole>>`。

### `GET /pku/:pid`

获取单个洞的最新数据。返回的 `data` 是单个 `Hole`，不是分页对象。

### 高级搜索限制

后端只暴露单个 `keyword`，没有发现原生 AND/NOT 参数。`+:` 和 `-:` 应当将基础词或第一个必含词发给服务端，然后在已加载候选集上做本地过滤。只有排除词时无法一次遍历全站。

## 5. 评论与详情

### `GET /pku_comment_v3/:pid`

| Query | 类型 | 说明 |
| --- | --- | --- |
| `page` | number | 可选；详情页从 `1` 开始 |
| `limit` | number | 卡片预览使用 `10`，详情页使用 `15` |
| `sort` | `asc` \| `desc` | 评论排序 |

响应：`ApiResponse<Paginated<Comment>>`。

### `POST /pku_comment_v3`

JSON Body：

```ts
interface CreateCommentBody {
  pid: number;
  text: string;
  comment_id?: number; // 回复某条评论时提供
}
```

成功时 `data` 为新评论。存档版还对业务码 `60001` 和 `30001` 做了特殊分支，但源码没有给出其语义，不应自行猜测。

## 6. 发布与图片

### `POST /pku_store`

Content-Type：`multipart/form-data`。

| FormData 字段 | 必填 | 说明 |
| --- | --- | --- |
| `text` | 是 | 正文；带图发布时可为空 |
| `type` | 是 | `text` 或 `image` |
| `label` | 否 | 标签 ID |
| `data` | 图片时 | 图片 File |

存档前端只接受 JPG/JPEG/PNG，并在上传前将超过 `716800` 字节的图片压缩为 JPEG。这是已观察的客户端限制，不代表后端的完整校验规则。

### 新版 `/chapi`：发布悬赏树洞

```http
POST /chapi/api/v3/hole/post
Content-Type: application/json
```

悬赏树洞与普通树洞使用同一个发布接口，通过 `kind` 和 `reward_cost` 区分：

```ts
interface CreateV3HoleBody {
  kind: 0 | 1;                 // 0 普通树洞；1 悬赏树洞
  type: "text" | "image";
  text: string;
  tags_ids: string;            // 无标签时为空字符串
  media_ids: string;           // 无图片时为空字符串
  identity_show: 0 | 1;
  identity_type: string;       // 身份类型 ID，多个值用逗号分隔
  exclusive_id_id?: number;
  reward_cost?: number;        // kind === 1 时提供，正整数且至少为 1
}
```

悬赏请求示例：

```json
{
  "kind": 1,
  "type": "text",
  "text": "求一份课程复习建议",
  "tags_ids": "",
  "media_ids": "",
  "identity_show": 0,
  "identity_type": "",
  "reward_cost": 8
}
```

普通树洞发送 `kind: 0`，且不发送 `reward_cost`。客户端兼容成功响应中的 `data` 为新洞号或完整 `Hole` 对象两种形式。

当前官方前端体现的悬赏规则：

- `reward_cost` 最小为 `1`，实际可用数量受账户树叶余额限制。
- 发布时立即扣除对应树叶。
- 未指定最佳答案或删除树洞，树叶也不会返还。

### 新版 `/chapi`：指定悬赏最佳答案

```http
POST /chapi/api/v3/comment/good
Content-Type: application/json
```

JSON Body：

```json
{
  "cid": 81021
}
```

其中 `cid` 是被指定为最佳答案的评论 ID。官方前端仅在同时满足以下条件时展示操作入口：

```ts
hole.kind === 1 &&
hole.islz === 1 &&
comment.is_lz === 0 &&
hole.has_reward_good === 0
```

也就是：当前树洞是未完成的悬赏、当前用户是洞主，并且目标回复不是洞主自己的回复。

操作成功后，客户端应同步更新：

- 目标评论 `reward_good = 1`；
- 当前树洞 `has_reward_good = 1`；
- 隐藏其余“设为最佳答案”入口；
- 将悬赏状态由“悬赏征集中”切换为“悬赏已完成”。

最佳答案与悬赏状态在刷新后应以服务端返回的 `reward_good` 和 `has_reward_good` 为准。

### `GET /pku_image/:pid`

返回图片 Blob。需要使用与 JSON API 相同的认证请求头。

```js
const response = await fetch(`/api/pku_image/${pid}`, {
  headers: {
    Authorization: `Bearer ${readCookie("pku_token")}`,
    Uuid: getDeviceUuid(),
  },
  credentials: "same-origin",
});
const objectUrl = URL.createObjectURL(await response.blob());
```

存档前端把大小恰好为 `96` 字节的 Blob 视为无图片响应；这是脆弱的旧逻辑，新实现应同时检查 HTTP 状态和 `Content-Type`。

## 7. 标签、关注与收藏

### `GET /pku/tags`

获取发布和筛选使用的标签。前端使用字段 `id` 和 `tag_name`。

### `POST /pku_attention/:pid`

切换对指定洞的关注状态，无请求体。存档前端将 `data === "关注成功"` 视为已关注，否则按取消关注更新本地状态。

### 收藏分组

| 方法 | 路径 | JSON Body | 说明 |
| --- | --- | --- | --- |
| `GET` | `/bookmark` | 无 | 获取分组列表 |
| `POST` | `/bookmark` | `{ bookmark_name }` | 创建分组 |
| `POST` | `/bookmark/update` | `{ id, bookmark_name }` | 重命名分组 |
| `POST` | `/bookmark/destroy` | `{ id }` | 删除分组 |
| `POST` | `/bookmark/follow` | `{ pid, bookmark_id }` | 将洞加入分组 |
| `POST` | `/bookmark/follow` | `{ pid, bookmark_id, del: 1 }` | 将洞移出分组 |

## 8. 屏蔽词

| 方法 | 路径 | Body/响应 |
| --- | --- | --- |
| `GET` | `/person_blocking_words/index` | `data.keywords` 为使用 `\|` 分隔的字符串 |
| `POST` | `/person_blocking_words/store` | `{ keywords }` 替换完整屏蔽词字符串 |

空列表删除时，新版页面提交 `{ del: 1 }`。

## 9. 消息通知

以下路径均位于新版 `/chapi/api/v3/message` 下：

| 方法 | 路径 | 参数/说明 |
| --- | --- | --- |
| `GET` | `/index` | `page`、`limit`、`message_type=int_msg\|sys_msg` |
| `GET` | `/un_read` | `message_type=int_msg\|sys_msg`，返回 `count` |
| `POST` | `/set_read` | `{ message_type }`，将一类消息全部标为已读 |
| `POST` | `/setIntMsgReadByID` | `{ id }`，将一条互动消息标为已读 |
| `POST` | `/delIntMsg` | `{ id }`，删除一条互动消息 |
| `POST` | `/person_blocking_words/store` | `{ keywords: "", del: 1 }` 清空屏蔽词 |

原前端直接使用 `new RegExp(keywords)` 匹配正文，因此这个字段实际上是正则表达式，不是单纯的文本数组。重构时应捕获非法正则异常。

## 9. 举报

### `GET /report_content`

获取举报原因列表。前端使用每项的 `id` 和 `contents`。

### `POST /pku_report/:pid`

举报主帖。

```ts
interface ReportHoleBody {
  reason: number | string;
  other?: string;
}
```

### `POST /pku_comment/report`

举报评论。

```ts
interface ReportCommentBody extends ReportHoleBody {
  cid: number;
}
```

存档前端在成功响应 `data === 1` 时会将相应主帖或评论从界面移除。

## 10. 消息

| 方法 | 路径 | 参数 | 说明 |
| --- | --- | --- | --- |
| `GET` | `/mail/index` | `page`, `limit` | 分页消息列表，原页面 `limit=15` |
| `GET` | `/mail/show` | `id` | 打开/标记单条消息 |
| `GET` | `/mail/un_read` | 无 | 未读消息状态 |
| `GET` | `/mail/set_read` | 无 | 全部标记已读 |

消息列表项至少包含 `id`、`contents`、`created_at`、`is_read` 和可选 `pid`。

## 11. 其他树洞接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/pku/manager_spec` | 每日提示/管理规范，前端读取 `data.desc` |
| `POST` | `/logout` | 退出登录 |
| `POST` | `/test_login` | 测试登录；请求体未从主页调用点确认 |

## 12. 登录与验证相关

这些接口在 API 封装中存在，但不建议在首版重构中自行实现官方认证流程。

| 方法 | 路径 |
| --- | --- |
| `POST` | `/jwt_send_msg` |
| `POST` | `/jwt_msg_verify` |
| `POST` | `/check_otp` |
| `POST` | `/login_iaaa_check_token` |
| `GET` | `/title-otp` |
| `GET` | `/captcha/image` |
| `POST` | `/captcha/verfiy?token=:token` |
| `POST` | `/code_verify` |
| `POST` | `/code_verify?token=:token` |
| `POST` | `/agreement` |
| `POST` | `/agreement?token=:token` |

注意：源码中的路径确实拼写为 `verfiy`，文档保留该拼写。

IAAA 重新登录入口不在 `/api` 下：

```text
/redirect_iaaa_login?uuid=<pku-uuid>
```

## 13. 重构客户端注意事项

1. 只接管正常信息流路由；验证、协议和 IAAA 登录页应交还官方前端。
2. 不要在原 Vue DOM 内逐个替换节点。应创建独立根节点并隐藏原 `#app`，否则 Vue 重渲染会恢复被删除的控件。
3. 每个列表请求使用单独的 `AbortController`，搜索条件改变时取消旧请求。
4. 以 `pid`/`cid` 作为数据键去重，不要使用数组下标作为稳定标识。
5. 树洞正文是不可信用户输入。使用 `textContent`渲染，链接和 PID 识别由结构化解析器生成 DOM，不要直接写入 `innerHTML`。
6. 所有 `URL.createObjectURL()` 生成的图片 URL 在卡片卸载后都要调用 `URL.revokeObjectURL()`。
7. 对列表、评论、发布和关注操作都应有独立的 loading、empty 和 error 状态，不要用同一个全局布尔值。

## 14. 源码依据

- 新版 `/chapi` 悬赏字段、发布参数、最佳答案接口及展示条件：当前官方 `/ch/` 前端产物；本项目对应调用位于 `src/api.ts`。
- API 封装、认证请求头和端点定义：`北大树洞_files/chunk-d3039df2.5595e81d.js` 中的 Webpack 模块 `7c15`。
- 信息流、评论、发布、收藏、举报和消息的参数调用点：`北大树洞_files/chunk-97c5d8ec.12d215bb.js`。
- Token Cookie 读写：`北大树洞_files/chunk-d3039df2.5595e81d.js` 中的 Webpack 模块 `5f87`。
