package dy

import (
	"fmt"
	"log"
	"net/url"
	"strconv"
	"time"
)

func GetShorUrl(shareType string, shareUrl string, entity *DyBaseEntity) (map[string]any, error) {
	requestUrl := "https://www.douyin.com/aweme/v1/web/web_shorten/?"
	if shareType == "video" {
		ts := time.Now().Unix()
		parsedURL, err := url.Parse(shareUrl)
		if err != nil {
			fmt.Println("Error parsing URL:", err)
			return nil, err
		}
		// 获取查询参数
		queryParams := parsedURL.Query()
		// 修改查询参数 (替换 'query' 参数的值)
		queryParams.Set("ts", strconv.FormatInt(ts, 10))
		// 将修改后的查询参数重新赋值给 URL
		parsedURL.RawQuery = queryParams.Encode()
		shareUrl = parsedURL.String()
	}
	entity.Init(requestUrl)
	entity.
		AppendUrlParams("target", url.QueryEscape(shareUrl)).
		AppendUrlParams("belong", "aweme").
		AppendUrlParams("persist", "1")
	return DoGet(entity)
}

func GetShortUrlStr(shareType string, shareUrl string, entity *DyBaseEntity) string {
	if shareUrl == "" {
		return ""
	}
	shortUrlResponse, err := GetShorUrl(shareType, shareUrl, entity)
	if err != nil {
		return ""
	}
	if _, ok := shortUrlResponse["code"]; !ok {
		return ""
	}
	code := shortUrlResponse["code"].(float64)
	if code != 0 {
		log.Println("short url code is ", code, " shareUrl ", shareUrl, " device id is ", entity.WebDevice.Id)
		return ""
	}
	if _, ok := shortUrlResponse["message"]; ok {
		if shortUrlResponse["message"].(string) == "error" {
			log.Println("short url message is ", " shareUrl ", shareUrl, " device id is ", entity.WebDevice.Id)
			return ""
		}
	}
	shortUrl := shortUrlResponse["data"].(string)
	return shortUrl
}
