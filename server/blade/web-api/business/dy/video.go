package dy

import (
	"blade/web-api/business/dy/response"
	dto "blade/web-api/business/dy/response"
	"common/middleware/http"
	"common/utils"
	"encoding/json"
	"io"
	"log"
	"regexp"
	"strconv"
	"strings"
)

type VideoInfo struct {
	*DyBaseEntity
	VideoId string
}

func GetVideoInfo(videoInfo *VideoInfo) (map[string]any, error) {
	url := "https://www.douyin.com/aweme/v1/web/aweme/detail/?"
	videoInfo.Init(url)
	videoInfo.
		AppendUrlParams("aweme_id", videoInfo.VideoId)
	return DoGet(videoInfo)
}

func PlayerVideo(videoInfo *VideoInfo) (map[string]any, error) {
	params := map[string]interface{}{
		"aweme_type": 0,
		"item_id":    videoInfo.VideoId,
		"play_delta": 1,
		"source":     0,
	}
	url := "https://www-hj.douyin.com/aweme/v2/web/aweme/stats/?"
	videoInfo.Init(url)
	return DoPost(videoInfo, params, "application/x-www-form-urlencoded; charset=UTF-8")
}

func LoveVideo(videoInfo *VideoInfo) (map[string]any, error) {
	url := "https://www-hj.douyin.com/aweme/v1/web/commit/item/digg/?"
	params := map[string]interface{}{
		"aweme_id":  videoInfo.VideoId,
		"item_type": 0,
		"type":      1,
	}
	videoInfo.Init(url)
	return DoPost(videoInfo, params, "application/x-www-form-urlencoded; charset=UTF-8")
}

func GetVideoFeed(videoInfo *VideoInfo) (*response.ExtItemListDTO, error) {
	url := "https://www.douyin.com/aweme/v1/web/tab/feed/?tag_id=&share_aweme_id=&live_insert_type=&count=10&refresh_index=2&video_type_select=1&globalwid=&pull_type=2&min_window=0&free_right=0&view_count=2&plug_block=0&ug_source=&creative_id=&pc_client_type=1&pc_libra_divert=Mac&support_h265=1&support_dash=1"
	videoInfo.Init(url)
	feedResponse, err := DoGet(videoInfo)
	extItemListDTO := &response.ExtItemListDTO{}
	if err != nil {
		return extItemListDTO, err
	}
	awemeList := feedResponse["aweme_list"]
	if awemeList == nil {
		return extItemListDTO, nil
	}
	//转成数组
	awemeListArray := awemeList.([]any)
	data := map[string]*response.ExtItemDTO{}
	for _, aweme := range awemeListArray {
		extItem := &response.ExtItemDTO{}
		awemeMap := aweme.(map[string]any)
		awemeId := awemeMap["aweme_id"].(string)
		extItem.BusinessId = awemeId
		data[awemeId] = extItem
	}
	extItemListDTO.Data = data
	// float64转bool
	extItemListDTO.DataStatus = response.SUCCESS
	extItemListDTO.TotalNum = int(len(data))
	return extItemListDTO, nil
}

func GetVideoByWeb(businessId string, ip string) *response.ExtItemDTO {
	extItem := &response.ExtItemDTO{}
	extItem.BusinessId = businessId
	extItem.DataStatus = response.ERROR
	url := "https://www.iesdouyin.com/share/video/" + businessId
	headers := map[string]string{
		"Referer":    url,
		"User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
	}
	response, err := http.GetToResponse(url, "", headers, ip)
	if err != nil {
		return extItem
	}
	defer response.Body.Close()
	body, err := io.ReadAll(response.Body)
	if err != nil {
		return extItem
	}
	re := regexp.MustCompile(`(?s)window\._ROUTER_DATA\s*=\s*(\{.*\})`)
	matches := re.FindStringSubmatch(string(body))
	if len(matches) > 1 {
		result := map[string]interface{}{}
		if err := json.Unmarshal([]byte(matches[1]), &result); err != nil {
			log.Printf("Failed to parse JSON data: %v", err)
			return extItem
		}

		// 验证JSON数据结构
		if _, ok := result["loaderData"]; !ok {
			log.Printf("Invalid JSON structure: missing loaderData")
			return extItem
		}

		extItem = buildExtItemByWeb(result, extItem, businessId)
	}
	return extItem
}

func buildExtItemByWeb(result map[string]interface{}, extItem *response.ExtItemDTO, businessId string) *response.ExtItemDTO {
	loaderData := result["loaderData"]
	if loaderData == nil {
		return extItem
	}
	//便利loaderData的 key
	for key, value := range loaderData.(map[string]any) {
		if strings.Contains(key, "video_(id)") {
			videoData := value.(map[string]any)
			videoInfoRes := videoData["videoInfoRes"]
			if videoInfoRes == nil {
				return extItem
			}
			filter_list := videoInfoRes.(map[string]any)["filter_list"]
			if filter_list != nil {
				filter_list_array := filter_list.([]any)
				for _, filter := range filter_list_array {
					filter_map := filter.(map[string]any)
					filterReason := filter_map["filter_reason"].(string)
					if strings.Contains(filterReason, "SYSTEM_ITEM_NOT_EXIST") {
						extItem.DataStatus = response.DELETE
						return extItem
					}
					if strings.Contains(filterReason, "core_dep") || strings.Contains(filterReason, "status_deleted") || strings.Contains(filterReason, "status_self_see") || strings.Contains(filterReason, "filterReason") || strings.Contains(filterReason, "status_audit_self_see") {
						extItem.DataStatus = response.DELETE
						return extItem
					}
					if strings.Contains(filterReason, "author_secret") {
						extItem.DataStatus = response.SECRET
						return extItem
					}
				}
			}
			itemList := videoInfoRes.(map[string]any)["item_list"]
			if itemList == nil {
				extItem.DataStatus = response.DELETE
				return extItem
			}
			itemListArray := itemList.([]any)
			if len(itemListArray) == 0 {
				extItem.DataStatus = response.DELETE
				return extItem
			}
			videoInfo := itemListArray[0].(map[string]any)
			statistics := videoInfo["statistics"]
			if statistics == nil {
				return extItem
			}
			extItem.NowNum = int64(statistics.(map[string]any)["digg_count"].(float64))
			extItem.CommentNum = int64(statistics.(map[string]any)["comment_count"].(float64))
			extItem.ShareNum = int64(statistics.(map[string]any)["share_count"].(float64))
			extItem.CollectNum = int64(statistics.(map[string]any)["collect_count"].(float64))
			extItem.BusinessId = businessId
			extItem.DataStatus = response.SUCCESS
			desc := videoInfo["desc"].(string)
			extItem.Name = utils.RemoveEmojis(desc)
			anchorInfo := videoInfo["author"]
			if anchorInfo != nil {
				anchorInfoMap := anchorInfo.(map[string]any)
				extItem.Uid = ""
				extItem.ExtParams = map[string]interface{}{
					"secUid":   anchorInfoMap["sec_uid"].(string),
					"assistId": "",
					"shortUrl": "",
					"shareUrl": "http://www.douyin.com/video/" + businessId,
					"hsFlag":   false,
				}
			}
		}
	}
	return extItem
}

func GetVideoItemInfo(videoInfo *VideoInfo) *dto.ExtItemDTO {
	extItem := &dto.ExtItemDTO{}
	extItem.DataStatus = response.ERROR
	videoResponse, err := GetVideoInfo(videoInfo)
	if err != nil {
		return extItem
	}
	if _, ok := videoResponse["status_code"]; !ok {
		deviceID := 0
		if videoInfo.WebDevice != nil {
			deviceID = videoInfo.WebDevice.Id
		}
		log.Println("video not get data ", " videoId ", videoInfo.VideoId, " device id is ", deviceID)
		extItem.DataStatus = response.NOT_GET_DATA
		return extItem
	}
	statusCode := videoResponse["status_code"].(float64)
	if statusCode != 0 {
		return extItem
	}
	awemeDetail := videoResponse["aweme_detail"]
	if awemeDetail == nil {
		filterDetail := videoResponse["filter_detail"]
		if filterDetail != nil {
			filterDetailMap := filterDetail.(map[string]any)
			filterReason := filterDetailMap["filter_reason"].(string)

			if strings.Contains(filterReason, "core_dep") || strings.Contains(filterReason, "status_deleted") || strings.Contains(filterReason, "status_self_see") || strings.Contains(filterReason, "filterReason") || strings.Contains(filterReason, "status_audit_self_see") {
				extItem.DataStatus = response.DELETE
				log.Println("video delete ", " videoId ", videoInfo.VideoId)
				return extItem
			}
			if strings.Contains(filterReason, "author_secret") {
				extItem.DataStatus = response.SECRET
				log.Println("video secret ", " videoId ", videoInfo.VideoId)
				return extItem
			}
			extItem.DataStatus = response.DELETE
			return extItem
		}
		return extItem
	}
	awemeDetailMap := awemeDetail.(map[string]any)
	statistics := awemeDetailMap["statistics"]
	if statistics == nil {
		return extItem
	}
	extItem.NowNum = int64(statistics.(map[string]any)["digg_count"].(float64))
	extItem.BusinessId = videoInfo.VideoId
	extItem.DataStatus = response.SUCCESS
	desc := awemeDetailMap["desc"].(string)
	extItem.Name = utils.RemoveEmojis(desc)
	anchorInfo := awemeDetailMap["author"]
	shareUrl := awemeDetailMap["share_url"]
	if anchorInfo != nil {
		anchorInfoMap := anchorInfo.(map[string]any)
		extItem.Uid = anchorInfoMap["uid"].(string)
		extItem.ExtParams = map[string]interface{}{
			"secUid":   anchorInfoMap["sec_uid"].(string),
			"assistId": extItem.Uid,
			"shortUrl": GetShortUrlStr("video", shareUrl.(string), videoInfo.DyBaseEntity),
			"shareUrl": shareUrl,
			"hsFlag":   false,
		}
	}
	return extItem
}

func ConvertByVideoUrl(businessKey string, ip string) *response.ConvertItemDTO {
	convertItemDTO := &response.ConvertItemDTO{}
	convertItemDTO.DataStatus = response.ERROR
	typeValue := "video/"

	// 正则提取抖音链接
	if strings.Contains(businessKey, "v.douyin.com") {
		// 匹配抖音短链接的正则表达式 - 支持任意字符组合，可选的斜杠和查询参数 正则匹配到的是https://v.douyin.com/xxx/
		douyinRegex := regexp.MustCompile(`https://v\.douyin\.com/[^/\s?]+/?(\?[^\s]*)?`)
		matches := douyinRegex.FindString(businessKey)
		if matches != "" {
			//如果最后不是/结尾，则添加/
			if matches[len(matches)-1] != '/' {
				businessKey = matches + "/"
			} else {
				businessKey = matches
			}
		}
	}

	if strings.HasPrefix(businessKey, "http") {
		if strings.Contains(businessKey, "v.douyin.com") {
			headers := map[string]string{
				"Referer":    "https://www.douyin.com",
				"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
			}
			response, err := http.GetToResponse(businessKey, "", headers, ip)
			if err != nil {
				return convertItemDTO
			}
			defer response.Body.Close()
			businessKey = response.Request.URL.String()
		}
		log.Printf("ConvertByVideoUrl-businessKey:%s", businessKey)
		if strings.Contains(businessKey, "www.douyin.com") || strings.Contains(businessKey, "www.iesdouyin.com") {
			start := strings.Index(businessKey, typeValue)
			end := strings.Index(businessKey, "?")
			if start == -1 {
				typeValue = "note/"
				start = strings.Index(businessKey, typeValue)
				if start == -1 {
					convertItemDTO.DataStatus = dto.DELETE
					return convertItemDTO
				}
			}
			if end == -1 {
				end = len(businessKey)
			}
			businessKey = businessKey[start+len(typeValue) : end]
			businessKey = strings.Replace(businessKey, "/", "", 1)
		}
	}
	_, err := strconv.ParseUint(businessKey, 10, 64)
	if err != nil {
		convertItemDTO.DataStatus = dto.DELETE
		return convertItemDTO
	}
	convertItemDTO.ConvertValue = businessKey
	// 替换 / 为空
	convertItemDTO.Property = map[string]interface{}{
		"url":  "https://www.douyin.com/" + typeValue + businessKey,
		"type": strings.Replace(typeValue, "/", "", 1),
	}
	convertItemDTO.DataStatus = dto.SUCCESS
	return convertItemDTO
}
