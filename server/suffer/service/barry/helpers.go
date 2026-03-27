package barry

import (
	"strconv"
	"strings"

	"common/middleware/vipper"
)

const (
	barryInnerPrefixPath              = "barry.url.inner.prefix"
	barryInnerShopSuffixPath          = "barry.url.inner.shop.suffix"
	barryInnerManualListSuffixPath    = "barry.url.inner.manual.list.suffix"
	barryInnerManualSaveSuffixPath    = "barry.url.inner.manual.save.suffix"
	barryInnerManualDeleteSuffixPath  = "barry.url.inner.manual.delete.suffix"
	barryInnerManualExpireSuffixPath  = "barry.url.inner.manual.expire.suffix"
	barryInnerManualActiveSuffixPath  = "barry.url.inner.manual.active.suffix"
	barryInnerChannelDetailListPath   = "barry.url.inner.channel.detail.list.suffix"
	barryInnerChannelDetailSavePath   = "barry.url.inner.channel.detail.save.list.suffix"
	barryInnerChannelDetailUpdatePath = "barry.url.inner.channel.detail.update.list.suffix"
	barryInnerUserDetailListPath      = "barry.url.inner.user.detail.list.suffix"
	barryInnerUserDetailFindPath      = "barry.url.inner.user.detail.find.suffix"
	barryInnerUserDetailSavePath      = "barry.url.inner.user.detail.save.suffix"
	barryInnerUserDetailUpdatePath    = "barry.url.inner.user.detail.update.suffix"
	barryInnerRecordSummaryPath       = "barry.url.inner.record.summary.suffix"
	barryInnerUserWithdrawRecordPath  = "barry.url.inner.point.user.withdraw.record.suffix"
	barryInnerUserWithdrawAccountPath = "barry.url.inner.point.user.withdraw.account.suffix"
	barryInnerUserWithdrawFinishPath  = "barry.url.inner.point.user.withdraw.finish.suffix"
	barryInnerUserWithdrawCancelPath  = "barry.url.inner.point.user.withdraw.cancel.suffix"
)

func servicePath(configKey string) string {
	return strings.TrimSpace(vipper.GetString(configKey))
}

func innerServicePath(configKey string) string {
	prefix := strings.TrimRight(strings.TrimSpace(vipper.GetString(barryInnerPrefixPath)), "/")
	suffix := strings.TrimSpace(vipper.GetString(configKey))
	if prefix == "" {
		return ""
	}
	if suffix == "" {
		return prefix
	}
	return prefix + "/" + strings.TrimLeft(suffix, "/")
}

func intToString(value int) string {
	return strconv.Itoa(value)
}

func int64ToString(value int64) string {
	return strconv.FormatInt(value, 10)
}
