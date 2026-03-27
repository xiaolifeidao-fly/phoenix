package response

var (
	DELETE       = "DELETE"
	SECRET       = "SECRET"
	UN_AUTHORIZE = "UN_AUTHORIZE"
	ERROR        = "ERROR"
	NOT_GET_DATA = "NOT_GET_DATA"
	SUCCESS      = "SUCCESS"
)

var (
	HS_UID_TYPE = "HS"
	DY_UID_TYPE = "DY"
)

type BaseItem struct {
	DataStatus string `json:"dataStatus"`
}

type ConvertItemDTO struct {
	BaseItem
	ConvertValue string                 `json:"convertValue"`
	Property     map[string]interface{} `json:"property"`
}

type ExtItemDTO struct {
	BaseItem
	BusinessId        string                 `json:"businessId"`
	NowNum            int64                  `json:"nowNum"`
	CommentNum        int64                  `json:"commentNum"`
	ShareNum          int64                  `json:"shareNum"`
	CollectNum        int64                  `json:"collectNum"`
	FavoriteNum       int64                  `json:"favoriteNum"`
	FollowingNum      int64                  `json:"followingNum"`
	FansNum           int64                  `json:"fansNum"`
	Name              string                 `json:"name"`
	ShowFavoriteList  bool                   `json:"showFavoriteList"`
	ShowFollowingList bool                   `json:"showFollowingList"`
	ExtParams         map[string]interface{} `json:"extParams"`
	Property          map[string]interface{} `json:"property"`
	Uid               string                 `json:"uid"`
}

type ConvertUrlItemDTO struct {
	BaseItem
	UidType string `json:"uidType"`
	Uid     string `json:"uid"`
}

type ExtItemListDTO struct {
	BaseItem
	Property    map[string]interface{} `json:"property"`
	Data        map[string]*ExtItemDTO `json:"data"`
	TotalNum    int                    `json:"totalNum"`
	NextIndex   int64                  `json:"nextIndex"`
	HadMore     bool                   `json:"hadMore"`
	HotSoonFlag int                    `json:"hotSoonFlag"`
}

type AppExtItemListDTO struct {
	BaseItem
	Property    map[string]interface{}            `json:"property"`
	Data        map[string]map[string]interface{} `json:"data"`
	TotalNum    int                               `json:"totalNum"`
	NextIndex   int64                             `json:"nextIndex"`
	HadMore     bool                              `json:"hadMore"`
	HotSoonFlag int                               `json:"hotSoonFlag"`
}
