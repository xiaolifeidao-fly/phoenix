package dy

import (
	"blade/web-api/business/dy/response"
	dto "blade/web-api/business/dy/response"
	"common/middleware/http"
	"common/utils"
	"strconv"
	"strings"
)

type UserInfoEntity struct {
	*DyBaseEntity
	BusinessId   string
	BusinessType string
}

func getSecUidByVideoId(videoId string, userInfoEntity *UserInfoEntity) *dto.ExtItemDTO {
	videoInfo := &VideoInfo{
		DyBaseEntity: &DyBaseEntity{
			WebDevice: userInfoEntity.WebDevice,
			Ip:        userInfoEntity.Ip,
		},
		VideoId: videoId,
	}
	return GetVideoItemInfo(videoInfo)
}

func GetUserInfoByWeb(userInfoEntity *UserInfoEntity) (map[string]interface{}, error) {
	url := "https://www-hj.douyin.com/aweme/v1/web/user/profile/other/?"
	userInfoEntity.Init(url)
	userInfoEntity.
		AppendUrlParams("land_to", "1").
		AppendUrlParams("sec_user_id", userInfoEntity.BusinessId).
		AppendUrlParams("publish_video_strategy_type", "2").
		AppendUrlParams("personal_center_strategy", "1")
	return DoGet(userInfoEntity)
}

func GetUserInfo(userInfoEntity *UserInfoEntity) *response.ExtItemDTO {
	userInfoDTO := &response.ExtItemDTO{}
	userInfoDTO.DataStatus = response.ERROR
	secUid := userInfoEntity.BusinessId
	if userInfoEntity.BusinessType == "video" || userInfoEntity.BusinessType == "note" {
		extItemDTO := getSecUidByVideoId(userInfoEntity.BusinessId, userInfoEntity)
		if extItemDTO.DataStatus == dto.DELETE {
			userInfoDTO.DataStatus = dto.DELETE
			return userInfoDTO
		}
		secUid = extItemDTO.ExtParams["secUid"].(string)
	}
	userInfoEntity.BusinessId = secUid
	userInfo, err := GetUserInfoByWeb(userInfoEntity)
	if err != nil {
		return userInfoDTO
	}
	if _, ok := userInfo["status_code"]; !ok {
		userInfoDTO.DataStatus = response.NOT_GET_DATA
		return userInfoDTO
	}
	statusCode := userInfo["status_code"].(float64)
	if statusCode == 2 {
		userInfoDTO.DataStatus = response.DELETE
		return userInfoDTO
	}
	if statusCode != 0 {
		return userInfoDTO
	}
	userInfoDTO.BusinessId = secUid
	userInfoMap := userInfo["user"].(map[string]any)
	if _, ok := userInfoMap["show_favorite_list"]; ok {
		userInfoDTO.ShowFavoriteList = userInfoMap["show_favorite_list"].(bool)
	}
	if _, ok := userInfoMap["special_state_info"]; ok {
		specialStateInfo := userInfoMap["special_state_info"].(map[string]any)
		specialStateValue := specialStateInfo["special_state"].(float64)
		if specialStateValue == 1 {
			userInfoDTO.DataStatus = response.DELETE
			return userInfoDTO
		}
	}
	if _, ok := userInfoMap["general_permission"]; ok {
		generalPermission := userInfoMap["general_permission"].(map[string]any)
		followingFollowerListToast := generalPermission["following_follower_list_toast"]
		if followingFollowerListToast == nil {
			userInfoDTO.ShowFollowingList = true
		} else if followingFollowerListToast.(float64) == 1 {
			userInfoDTO.ShowFollowingList = false
		} else {
			userInfoDTO.ShowFollowingList = true
		}
	}

	secret := userInfoMap["secret"].(float64)
	if secret == 1 {
		userInfoDTO.DataStatus = response.SECRET
	} else {
		userInfoDTO.DataStatus = response.SUCCESS
	}
	shareUrl := getShareUrl(userInfoMap)
	userInfoDTO.ExtParams = map[string]interface{}{
		"url":      "https://www.douyin.com/user/" + secUid,
		"assistId": userInfoMap["uid"].(string),
		"shortUrl": GetShortUrlStr("user", shareUrl, userInfoEntity.DyBaseEntity),
		"shareUrl": shareUrl,
		"secUid":   secUid,
		"hsFlag":   false,
	}
	userInfoDTO.Uid = userInfoMap["uid"].(string)
	nickname := userInfoMap["nickname"].(string)
	userInfoDTO.Name = utils.RemoveEmojis(nickname)
	userInfoDTO.NowNum = int64(userInfoMap["mplatform_followers_count"].(float64))
	userInfoDTO.FavoriteNum = int64(userInfoMap["favoriting_count"].(float64))
	userInfoDTO.FollowingNum = int64(userInfoMap["following_count"].(float64))
	userInfoDTO.FansNum = userInfoDTO.NowNum
	return userInfoDTO
}

func getShareUrl(userInfoMap map[string]any) string {
	if userInfoMap["share_info"] == nil {
		return ""
	}
	shareInfo := userInfoMap["share_info"].(map[string]any)
	if shareInfo["share_url"] == nil {
		return ""
	}
	return shareInfo["share_url"].(string)
}

type UserFavoriteEntity struct {
	*DyBaseEntity
	SecUid    string
	MaxCursor int
	MinCursor int
	Count     int
}

func GetUserFavoriteByWeb(userFavoriteEntity *UserFavoriteEntity) (map[string]interface{}, error) {
	url := "https://www-hj.douyin.com/aweme/v1/web/aweme/favorite/?"
	userFavoriteEntity.Init(url)
	if userFavoriteEntity.Count == 0 {
		userFavoriteEntity.Count = 18
	}
	userFavoriteEntity.
		AppendUrlParams("sec_user_id", userFavoriteEntity.SecUid).
		AppendUrlParams("publish_video_strategy_type", "2").
		AppendUrlParams("cut_version", "1").
		AppendUrlParams("whale_cut_token", "").
		AppendUrlParams("count", userFavoriteEntity.Count).
		AppendUrlParams("max_cursor", userFavoriteEntity.MaxCursor).
		AppendUrlParams("min_cursor", userFavoriteEntity.MinCursor)
	return DoGet(userFavoriteEntity)
}

func GetUserFavorite(userFavoriteEntity *UserFavoriteEntity) *response.ExtItemListDTO {
	extItemListDTO := &response.ExtItemListDTO{}
	extItemListDTO.DataStatus = response.ERROR
	userFavoriteResult, err := GetUserFavoriteByWeb(userFavoriteEntity)
	if err != nil {
		return extItemListDTO
	}
	if _, ok := userFavoriteResult["status_code"]; !ok {
		extItemListDTO.DataStatus = response.NOT_GET_DATA
		return extItemListDTO
	}
	statusCode := userFavoriteResult["status_code"].(float64)
	if statusCode != 0 {
		return extItemListDTO
	}
	awemeList := userFavoriteResult["aweme_list"]
	if awemeList == nil {
		if userFavoriteResult["sec_uid"] != nil {
			extItemListDTO.DataStatus = response.SECRET
			return extItemListDTO
		}
		extItemListDTO.DataStatus = response.ERROR
		return extItemListDTO
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
	extItemListDTO.HadMore = userFavoriteResult["has_more"].(float64) != 0
	extItemListDTO.NextIndex = int64(userFavoriteResult["max_cursor"].(float64))
	extItemListDTO.DataStatus = response.SUCCESS
	extItemListDTO.TotalNum = int(len(data))
	return extItemListDTO
}

type UserFollowingEntity struct {
	*DyBaseEntity
	UserId string
	SecUid string
	Offset int
	Count  int
}

func GetUserFollowingByWeb(userFollowEntity *UserFollowingEntity) (map[string]interface{}, error) {
	url := "https://www.douyin.com/aweme/v1/web/user/following/list/?"
	userFollowEntity.Init(url)
	userFollowEntity.Count = 20
	userFollowEntity.
		AppendUrlParams("user_id", userFollowEntity.UserId).
		AppendUrlParams("sec_user_id", userFollowEntity.SecUid).
		AppendUrlParams("offset", userFollowEntity.Offset).
		AppendUrlParams("count", userFollowEntity.Count).
		AppendUrlParams("source_type", "4").
		AppendUrlParams("is_top", "1").
		AppendUrlParams("min_time", "0").
		AppendUrlParams("max_time", "0").
		AppendUrlParams("gps_access", "0").
		AppendUrlParams("address_book_access", "0")
	return DoGet(userFollowEntity)
}

func getUid(uidType string, url string, userInfoEntity *UserInfoEntity) string {
	if strings.EqualFold(response.DY_UID_TYPE, uidType) {
		startIndex := strings.Index(url, "user/")
		endIndex := len(url)
		secUid := url[startIndex+5 : endIndex]
		userInfoEntity.BusinessId = secUid
		userInfo, err := GetUserInfoByWeb(userInfoEntity)
		if err != nil {
			return ""
		}
		statusCode := userInfo["status_code"].(float64)
		if statusCode != 0 {
			return ""
		}
		user := userInfo["user"]
		if user == nil {
			return ""
		}
		userMap := user.(map[string]any)
		uid := userMap["uid"].(string)
		return uid
	}

	if strings.EqualFold(response.HS_UID_TYPE, uidType) {
		startIndex := strings.Index(url, "?to_user_id=")
		endIndex := strings.Index(url, "&")
		if endIndex == -1 {
			endIndex = len(url)
		}
		return url[startIndex+12 : endIndex]
	}
	return ""
}

func getUidType(url string) string {
	if strings.Contains(url, "www.douyin.com/user/") {
		return response.DY_UID_TYPE
	}
	if strings.Contains(url, "share.huoshan.com/pages/user/index.html/") {
		return response.HS_UID_TYPE
	}
	return ""
}

func GetUrlByUrl(url string, userInfoEntity *UserInfoEntity) *response.ConvertUrlItemDTO {
	convertUrlItemDTO := &response.ConvertUrlItemDTO{}
	convertUrlItemDTO.DataStatus = response.ERROR
	uidType := getUidType(url)
	if uidType == "" {
		return convertUrlItemDTO
	}
	convertUrlItemDTO.UidType = uidType
	uid := getUid(uidType, url, userInfoEntity)
	if uid == "" {
		return convertUrlItemDTO
	}
	convertUrlItemDTO.Uid = uid
	convertUrlItemDTO.DataStatus = response.SUCCESS
	return convertUrlItemDTO
}

func ConvertByUserUrl(businessKey string, ip string) *response.ConvertItemDTO {
	convertItemDTO := &response.ConvertItemDTO{}
	convertItemDTO.DataStatus = response.ERROR
	typeValue := "video/"
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
		if strings.Contains(businessKey, "www.douyin.com") || strings.Contains(businessKey, "www.iesdouyin.com") {
			start := strings.Index(businessKey, typeValue)
			end := strings.Index(businessKey, "?")
			if start == -1 {
				typeValue = "user/"
				start = strings.Index(businessKey, typeValue)
				if start == -1 {
					typeValue = "note/"
					start = strings.Index(businessKey, typeValue)
					if start == -1 {
						convertItemDTO.DataStatus = dto.DELETE
						return convertItemDTO
					}
				}
			}
			if end == -1 {
				end = len(businessKey)
			}
			businessKey = businessKey[start+len(typeValue) : end]
		}
	}
	convertItemDTO.ConvertValue = businessKey
	extParams := map[string]interface{}{}
	businessType := "user"
	if typeValue == "video/" {
		businessType = "video"
		extParams["videoUrl"] = "https://www.douyin.com/video/" + businessKey
		_, err := strconv.ParseUint(businessKey, 10, 64)
		if err != nil {
			convertItemDTO.DataStatus = dto.DELETE
			return convertItemDTO
		}
	} else if typeValue == "note/" {
		businessType = "note"
		extParams["videoUrl"] = "https://www.douyin.com/note/" + businessKey
	}
	extParams["businessType"] = businessType
	convertItemDTO.Property = extParams
	convertItemDTO.DataStatus = dto.SUCCESS
	return convertItemDTO
}
