FROM golang:1.21-alpine AS builder

WORKDIR /src

COPY common ./common
COPY suffer/service ./suffer/service
COPY suffer/web-api ./suffer/web-api

WORKDIR /src/suffer/web-api
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o /out/web-api ./cmd.go

FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata \
    && addgroup -S app \
    && adduser -S -G app app

WORKDIR /data/program/app/web-api

COPY --from=builder /out/web-api ./web-api
COPY --from=builder /src/suffer/web-api/configs ./configs

ENV TZ=Asia/Shanghai

USER app
EXPOSE 7091

CMD ["./web-api"]
