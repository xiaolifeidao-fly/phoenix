package constants

type DictionaryCode struct {
	Code string
	Desc string
}

var (
	CURRENT_DATE            = DictionaryCode{Code: "CURRENT_DATE", Desc: "当前日期"}
	CURRENT_PHONE_TYPE      = DictionaryCode{Code: "CURRENT_PHONE_TYPE", Desc: "当前号码类型"}
	DEVICE_NUM              = DictionaryCode{Code: "DEVICE_NUM", Desc: "设备数量"}
	MIN_DEVICE_PARAM_ID     = DictionaryCode{Code: "MIN_DEVICE_PARAM_ID", Desc: "设备param最小ID"}
	CURRENT_DEVICE_INDEX    = DictionaryCode{Code: "CURRENT_DEVICE_INDEX", Desc: "当前设备索引位置"}
	CURRENT_TASK_NUM        = DictionaryCode{Code: "CURRENT_TASK_NUM", Desc: "当前任务数量"}
	FOLLOW_CURRENT_TASK_NUM = DictionaryCode{Code: "FOLLOW_CURRENT_TASK_NUM", Desc: "关注当前任务数量"}
	CURRENT_PLAY_TASK_NUM   = DictionaryCode{Code: "CURRENT_PLAY_TASK_NUM", Desc: "当前播放任务数量"}
	BATCH_PROXY_CODE        = DictionaryCode{Code: "BATCH_PROXY_CODE", Desc: "批量代理code"}
	USER_ID_CONFIG          = DictionaryCode{Code: "USER_ID_CONFIG", Desc: "用户id配置"}
	FOLLOW_USER_ID_CONFIG   = DictionaryCode{Code: "FOLLOW_USER_ID_CONFIG", Desc: "关注用户id配置"}
	DEVICE_PARAM_ID_CONFIG  = DictionaryCode{Code: "DEVICE_PARAM_ID_CONFIG", Desc: "配置参数id配置"}
	COMMON_USER_ID          = DictionaryCode{Code: "COMMON_USER_ID", Desc: "公用用户id配置"}
	FOLLOW_COMMON_USER_ID   = DictionaryCode{Code: "FOLLOW_COMMON_USER_ID", Desc: "关注公用用户id配置"}
	SPLIT_NO                = DictionaryCode{Code: "SPLIT_NO", Desc: "拆分数量"}
	BATCH_NO_INDEX          = DictionaryCode{Code: "BATCH_NO_INDEX", Desc: "批次号位置"}
	BUSINESS_TYPES          = DictionaryCode{Code: "BUSINESS_TYPES", Desc: "用户支持业务类型"}
	CONCURRENT_NO           = DictionaryCode{Code: "CONCURRENT_NO", Desc: "并发数量"}

	GET_CL_LOVE_ITEM_FLAG             = DictionaryCode{Code: "GET_CL_LOVE_ITEM_FLAG", Desc: "获取丛林点赞开关"}
	GET_CL_JS_LOVE_ITEM_FLAG          = DictionaryCode{Code: "GET_CL_JS_LOVE_ITEM_FLAG", Desc: "获取丛林极速点赞开关"}
	GET_CL_LOVE_RE_FOUND_ITEM_FLAG    = DictionaryCode{Code: "GET_CL_LOVE_RE_FOUND_ITEM_FLAG", Desc: "丛林点赞退货开关"}
	GET_CL_JS_LOVE_RE_FOUND_ITEM_FLAG = DictionaryCode{Code: "GET_CL_JS_LOVE_RE_FOUND_ITEM_FLAG", Desc: "丛林点赞极速退货开关"}
	GET_CL_FOLLOW_ITEM_FLAG           = DictionaryCode{Code: "GET_CL_FOLLOW_ITEM_FLAG", Desc: "获取丛林关注开关"}
	GET_CL_FOLLOW_RE_FOUND_ITEM_FLAG  = DictionaryCode{Code: "GET_CL_FOLLOW_RE_FOUND_ITEM_FLAG", Desc: "获取丛林退货关注开关"}

	GET_XM_LOVE_ITEM_FLAG          = DictionaryCode{Code: "GET_XM_LOVE_ITEM_FLAG", Desc: "获取熊猫点赞开关"}
	GET_XM_LOVE_RE_FOUND_ITEM_FLAG = DictionaryCode{Code: "GET_XM_LOVE_RE_FOUND_ITEM_FLAG", Desc: "熊猫点赞退货开关"}

	GET_JD1_LOVE_ITEM_FLAG            = DictionaryCode{Code: "GET_JD1_LOVE_ITEM_FLAG", Desc: "获取巨鼎1点赞开关"}
	GET_JD1_LOVE_RE_FOUND_ITEM_FLAG   = DictionaryCode{Code: "GET_JD1_LOVE_RE_FOUND_ITEM_FLAG", Desc: "丛林巨鼎1退货开关"}
	GET_JD1_FOLLOW_ITEM_FLAG          = DictionaryCode{Code: "GET_JD1_FOLLOW_ITEM_FLAG", Desc: "获取巨鼎1关注开关"}
	GET_JD1_FOLLOW_RE_FOUND_ITEM_FLAG = DictionaryCode{Code: "GET_JD1_FOLLOW_RE_FOUND_ITEM_FLAG", Desc: "获取巨鼎1退货关注开关"}

	GET_JD2_LOVE_ITEM_FLAG            = DictionaryCode{Code: "GET_JD2_LOVE_ITEM_FLAG", Desc: "获取巨鼎2点赞开关"}
	GET_JD2_LOVE_RE_FOUND_ITEM_FLAG   = DictionaryCode{Code: "GET_JD2_LOVE_RE_FOUND_ITEM_FLAG", Desc: "丛林巨鼎2退货开关"}
	GET_JD2_FOLLOW_ITEM_FLAG          = DictionaryCode{Code: "GET_JD2_FOLLOW_ITEM_FLAG", Desc: "获取巨鼎2关注开关"}
	GET_JD2_FOLLOW_RE_FOUND_ITEM_FLAG = DictionaryCode{Code: "GET_JD2_FOLLOW_RE_FOUND_ITEM_FLAG", Desc: "获取巨鼎2退货关注开关"}

	GET_CL_PLAY_ITEM_FLAG          = DictionaryCode{Code: "GET_CL_PLAY_ITEM_FLAG", Desc: "获取丛林播放开关"}
	GET_YL_PLAY_ITEM_FLAG          = DictionaryCode{Code: "GET_YL_PLAY_ITEM_FLAG", Desc: "获取艺乐播放开关"}
	GET_CL_PLAY_RE_FOUND_ITEM_FLAG = DictionaryCode{Code: "GET_CL_PLAY_RE_FOUND_ITEM_FLAG", Desc: "丛林播放退货开关"}
	GET_YL_PLAY_RE_FOUND_ITEM_FLAG = DictionaryCode{Code: "GET_YL_PLAY_RE_FOUND_ITEM_FLAG", Desc: "艺乐播放退货开关"}
	GET_YL_LOVE_RE_FOUND_ITEM_FLAG = DictionaryCode{Code: "GET_YL_LOVE_RE_FOUND_ITEM_FLAG", Desc: "艺乐点赞退货开关"}
	GET_YL_LOVE_ITEM_FLAG          = DictionaryCode{Code: "GET_YL_LOVE_ITEM_FLAG", Desc: "获取艺乐点赞开关"}

	PROXY_BATCH_TYPE      = DictionaryCode{Code: "PROXY_BATCH_TYPE", Desc: "代理批量类型"}
	PLAY_PROXY_BATCH_TYPE = DictionaryCode{Code: "PLAY_PROXY_BATCH_TYPE", Desc: "播放代理批量类型"}

	JS_USER_RANGE_ID          = DictionaryCode{Code: "JS_USER_RANGE_ID", Desc: "机刷用户区间"}
	FINISH_SLAVER_CONFIG      = DictionaryCode{Code: "FINISH_SLAVER_CONFIG", Desc: "完成服务配置"}
	FINISH_SLAVER_JSON_CONFIG = DictionaryCode{Code: "FINISH_SLAVER_JSON_CONFIG", Desc: "完成服务JSON配置"}
	JS_USER_FETCH_NUM         = DictionaryCode{Code: "JS_USER_FETCH_NUM", Desc: "机刷用户任务取值数量"}

	DEVICE_GOOD_CURRENT_INDEX = DictionaryCode{Code: "DEVICE_GOOD_CURRENT_INDEX", Desc: "设备当前值"}
	DEVICE_GOOD_ID_RANGE      = DictionaryCode{Code: "DEVICE_GOOD_ID_RANGE", Desc: "设备区间"}
	DEVICE_GOOD_FETCH_NUM     = DictionaryCode{Code: "DEVICE_GOOD_FETCH_NUM", Desc: "设备使用限制"}

	DEVICE_XIAOMI_CURRENT_INDEX = DictionaryCode{Code: "DEVICE_XIAOMI_CURRENT_INDEX", Desc: "设备当前值"}
	DEVICE_XIAOMI_ID_RANGE      = DictionaryCode{Code: "DEVICE_XIAOMI_ID_RANGE", Desc: "设备区间"}
	DEVICE_XIAOMI_FETCH_NUM     = DictionaryCode{Code: "DEVICE_XIAOMI_FETCH_NUM", Desc: "设备使用限制"}

	DEVICE_MINE_CURRENT_INDEX = DictionaryCode{Code: "DEVICE_MINE_CURRENT_INDEX", Desc: "设备当前值"}
	DEVICE_MINE_ID_RANGE      = DictionaryCode{Code: "DEVICE_MINE_ID_RANGE", Desc: "设备区间"}
	DEVICE_MINE_FETCH_NUM     = DictionaryCode{Code: "DEVICE_MINE_FETCH_NUM", Desc: "设备使用限制"}

	DEVICE_PARAM_CURRENT_INDEX = DictionaryCode{Code: "DEVICE_PARAM_CURRENT_INDEX", Desc: "设备当前值"}
	DEVICE_PARAM_ID_RANGE      = DictionaryCode{Code: "DEVICE_PARAM_ID_RANGE", Desc: "设备区间"}
	DEVICE_PARAM_FETCH_NUM     = DictionaryCode{Code: "DEVICE_PARAM_FETCH_NUM", Desc: "设备使用限制"}

	DEVICE_XHS_CURRENT_INDEX = DictionaryCode{Code: "DEVICE_XHS_CURRENT_INDEX", Desc: "xhs设备当前值"}
	DEVICE_XHS_ID_RANGE      = DictionaryCode{Code: "DEVICE_XHS_ID_RANGE", Desc: "xhs设备区间"}
	DEVICE_XHS_FETCH_NUM     = DictionaryCode{Code: "DEVICE_XHS_FETCH_NUM", Desc: "xhs设备使用限制"}

	WEB_DEVICE_CURRENT_INDEX = DictionaryCode{Code: "WEB_DEVICE_CURRENT_INDEX", Desc: "web设备当前值"}
	WEB_DEVICE_MAX_USE       = DictionaryCode{Code: "WEB_DEVICE_MAX_USE", Desc: "web设备最大使用次数"}
	WEB_DEVICE_ID_RANGE      = DictionaryCode{Code: "WEB_DEVICE_ID_RANGE", Desc: "web设备一次取的数量"}
)
