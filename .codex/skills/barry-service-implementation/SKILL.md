---
name: barry-service-implementation
description: 面向本仓库 Phoenix 代理 Barry 服务的 Go 后端实现技能。Use when implementing or modifying Barry-related services, DTOs, handlers, gateway routing, or application.properties config under server/suffer/service/barry and server/suffer/web-api/pkg/barry; especially when deciding whether Barry 配置类/查询类接口 should call Barry-gateway-inner and 进件/退单/订单流转类接口 should call barry-gateway-inlet.
---

# Barry Service Implementation

## Overview

Use this skill for Phoenix-side Barry proxy work. The target shape is: manager frontend calls Phoenix `/barry/...`, Phoenix `server/suffer/web-api/pkg/barry` binds and validates requests, Phoenix `server/suffer/service/barry` forwards to the correct Barry gateway, and Barry remains the source of truth for Controller paths, DTO fields, method types, and response envelopes.

## Gateway Rule

Always classify the Barry API before coding:

- 配置类、查询类、管理类接口 call Barry `gateway-inner`.
- 进件、退单、订单流转类接口 call Barry `barry-gateway-inlet`.
- Do not infer the gateway from an existing Phoenix config key alone. Confirm the Barry source first, then name the Phoenix config after the actual gateway.

When a request is ambiguous, prefer reading Barry Controller names and business meaning over route wording. A list page for entries/returns can still belong to inlet if the Barry service exposes it from the order-flow gateway.

## Source Checks

Before implementing or migrating an endpoint:

1. Search the Barry project source for the Controller route, method, request DTO, response DTO, and service method.
2. Check whether Barry exposes it through `gateway-inner` or `barry-gateway-inlet`.
3. Check current Phoenix code in `server/suffer/service/barry`, `server/suffer/web-api/pkg/barry`, and `server/suffer/web-api/configs/application.properties`.
4. Reuse the current Phoenix DTO/response helpers when they already match Barry's response shape.

If Barry source and Phoenix assumptions disagree, trust Barry source and adjust Phoenix config/service naming to make the gateway explicit.

## Phoenix Service Pattern

Put Barry forwarding code under `server/suffer/service/barry`.

- Use one focused service file per business area, for example `entry_service.go`, `return_service.go`, `assign_config_service.go`.
- Add DTOs to `server/suffer/service/barry/dto/dto.go` unless the file becomes too large, then split by domain using the existing package name.
- Register each service in `BarryService` so handlers access it through `h.barryService.<Domain>`.
- Use `Client.GetAbsolute` / `Client.PostAbsolute` for gateway-specific absolute URLs built from prefix + suffix helpers.
- Keep request parameters explicit with `buildValues`; do not silently drop required Barry fields.

For `gateway-inner`, follow the existing pattern:

```go
const barryInnerAssignConfigListPath = "barry.url.inner.assign.config.list.suffix"

err := s.client.GetAbsolute(ctx, innerServicePath(barryInnerAssignConfigListPath), values, response)
```

For `barry-gateway-inlet`, create or use an explicit inlet equivalent:

```go
const (
    barryInletPrefixPath = "barry.url.inlet.prefix"
    barryInletEntryListPath = "barry.url.inlet.entry.list.suffix"
)

err := s.client.GetAbsolute(ctx, inletServicePath(barryInletEntryListPath), values, response)
```

Do not route new 进件/退单 work through `barry.url.inner.*`. Avoid adding new gateway-specific APIs to the legacy generic `barry.services.*` namespace unless compatibility with existing code requires a temporary bridge.

## Handler Pattern

Put Phoenix HTTP routes under `server/suffer/web-api/pkg/barry`.

- Register routes from `BarryHandler.RegisterHandler` through focused helper methods such as `registerTransactionRoutes`.
- Use `/barry/...` route prefixes consistently.
- Bind query requests with `ShouldBindQuery` and body requests with `ShouldBindJSON`.
- Use `normalizeBarryPage` / `normalizeBarryPageWithDefault` for paged list endpoints.
- Return through `commonRouter.ToJson` / `commonRouter.ToError`.
- For Barry action responses, check `Success` and use Barry `Message` when provided before falling back to local Chinese error text.

## Config Pattern

Put new config in `server/suffer/web-api/configs/application.properties`.

- Inner prefix: `barry.url.inner.prefix`
- Inner suffixes: `barry.url.inner.<domain>.<action>.suffix`
- Inlet prefix: `barry.url.inlet.prefix`
- Inlet suffixes: `barry.url.inlet.<domain>.<action>.suffix`

Keep suffix values as paths, not full URLs, when using prefix helpers. Use full URLs only for deliberate exceptions and name them so the gateway is still obvious.

## Validation Checklist

Before finishing Barry service work:

- Barry source path, HTTP method, DTO fields, and response envelope were checked.
- 配置/查询类 endpoints use `gateway-inner`.
- 进件/退单/订单流转 endpoints use `barry-gateway-inlet`.
- New service is wired into `BarryService`.
- New handler route is registered.
- New config keys are present and gateway-specific.
- Existing user changes in Barry files were preserved.
- Relevant Go package builds or targeted tests were run when feasible.
