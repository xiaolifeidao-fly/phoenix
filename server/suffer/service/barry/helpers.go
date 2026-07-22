package barry

import (
	"strconv"
	"strings"

	"common/middleware/vipper"
)

const (
	barryInnerPrefixPath               = "barry.url.inner.prefix"
	barryInnerShopSuffixPath           = "barry.url.inner.shop.suffix"
	barryInnerManualListSuffixPath     = "barry.url.inner.manual.list.suffix"
	barryInnerManualSaveSuffixPath     = "barry.url.inner.manual.save.suffix"
	barryInnerManualDeleteSuffixPath   = "barry.url.inner.manual.delete.suffix"
	barryInnerManualExpireSuffixPath   = "barry.url.inner.manual.expire.suffix"
	barryInnerManualActiveSuffixPath   = "barry.url.inner.manual.active.suffix"
	barryInnerAssignConfigListPath     = "barry.url.inner.assign.config.list.suffix"
	barryInnerAssignConfigSavePath     = "barry.url.inner.assign.config.save.suffix"
	barryInnerJudgeConfigListPath      = "barry.url.inner.judge.config.list.suffix"
	barryInnerJudgeConfigSavePath      = "barry.url.inner.judge.config.save.suffix"
	barryInnerAssignUidRuleGetPath     = "barry.url.inner.assign.uid.rule.get.suffix"
	barryInnerAssignUidRuleSavePath    = "barry.url.inner.assign.uid.rule.save.suffix"
	barryInnerAssignVideoRuleGetPath   = "barry.url.inner.assign.video.rule.get.suffix"
	barryInnerAssignVideoRuleSavePath  = "barry.url.inner.assign.video.rule.save.suffix"
	barryInnerAssignRefundRuleGetPath  = "barry.url.inner.assign.refund.rule.get.suffix"
	barryInnerAssignRefundRuleSavePath = "barry.url.inner.assign.refund.rule.save.suffix"

	barryInnerAssignVideoUserRuleListPath   = "barry.url.inner.assign.video.user.rule.list.suffix"
	barryInnerAssignVideoUserRuleSavePath   = "barry.url.inner.assign.video.user.rule.save.suffix"
	barryInnerAssignVideoUserRuleDeletePath = "barry.url.inner.assign.video.user.rule.delete.suffix"

	barryInnerAssignWhitelistSwitchGetPath                    = "barry.url.inner.assign.whitelist.switch.get.suffix"
	barryInnerAssignWhitelistSwitchSavePath                   = "barry.url.inner.assign.whitelist.switch.save.suffix"
	barryInnerAssignUidSwitchGetPath                          = "barry.url.inner.assign.uid.switch.get.suffix"
	barryInnerAssignUidSwitchSavePath                         = "barry.url.inner.assign.uid.switch.save.suffix"
	barryInnerAppUserListPath                                 = "barry.url.inner.app.user.list.suffix"
	barryInnerUserWhitelistListPath                           = "barry.url.inner.user.whitelist.list.suffix"
	barryInnerUserWhitelistSavePath                           = "barry.url.inner.user.whitelist.save.suffix"
	barryInnerUserWhitelistActivePath                         = "barry.url.inner.user.whitelist.active.suffix"
	barryInnerUserWhitelistGroupPath                          = "barry.url.inner.user.whitelist.group.suffix"
	barryInnerChannelDetailListPath                           = "barry.url.inner.channel.detail.list.suffix"
	barryInnerChannelDetailSavePath                           = "barry.url.inner.channel.detail.save.list.suffix"
	barryInnerChannelDetailUpdatePath                         = "barry.url.inner.channel.detail.update.list.suffix"
	barryInnerUserDetailBasicListPath                         = "barry.url.inner.user.detail.basic.list.suffix"
	barryInnerUserDetailListPath                              = "barry.url.inner.user.detail.list.suffix"
	barryInnerUserDetailFindPath                              = "barry.url.inner.user.detail.find.suffix"
	barryInnerUserDetailSavePath                              = "barry.url.inner.user.detail.save.suffix"
	barryInnerUserDetailUpdatePath                            = "barry.url.inner.user.detail.update.suffix"
	barryInnerUserDetailPasswordUpdatePath                    = "barry.url.inner.user.detail.password.update.suffix"
	barryInnerUserPaymentMethodListPath                       = "barry.url.inner.user.payment.method.list.suffix"
	barryInnerRecordSummaryPath                               = "barry.url.inner.record.summary.suffix"
	barryInnerManualTaskStatisticsPath                        = "barry.url.inner.manual.task.statistics.suffix"
	barryInnerOrderStatisticsPath                             = "barry.url.inner.statistics.suffix"
	barryWorkbenchManualSubmittedGroupCodePath                = "barry.workbench.dashboard.manual.submitted.group.code"
	barryInnerWorkbenchDashboardUserOverviewPath              = "barry.url.inner.workbench.dashboard.user.overview.suffix"
	barryInnerWorkbenchDashboardUserOnlineOverviewPath        = "barry.url.inner.workbench.dashboard.user.online.overview.suffix"
	barryInnerWorkbenchDashboardTaskRemainingPath             = "barry.url.inner.workbench.dashboard.task.remaining.suffix"
	barryInnerWorkbenchDashboardManualSubmittedPath           = "barry.url.inner.workbench.dashboard.manual.submitted.suffix"
	barryInnerWorkbenchDashboardManualSubmittedComparisonPath = "barry.url.inner.workbench.dashboard.manual.submitted.comparison.suffix"
	barryInnerWorkbenchDashboardManualSpeedPath               = "barry.url.inner.workbench.dashboard.manual.speed.suffix"
	barryInnerWorkbenchDashboardActualCompletedPath           = "barry.url.inner.workbench.dashboard.actual.completed.suffix"
	barryInnerManualTaskStatisticsUsersPath                   = "barry.url.inner.manual.task.statistics.users.suffix"
	barryInnerUserWithdrawRecordPath                          = "barry.url.inner.point.user.withdraw.record.suffix"
	barryInnerUserWithdrawAccountPath                         = "barry.url.inner.point.user.withdraw.account.suffix"
	barryInnerUserWithdrawFinishPath                          = "barry.url.inner.point.user.withdraw.finish.suffix"
	barryInnerUserWithdrawCancelPath                          = "barry.url.inner.point.user.withdraw.cancel.suffix"
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

func configuredInnerServicePath(configKey string) string {
	if strings.TrimSpace(vipper.GetString(configKey)) == "" {
		return ""
	}
	return innerServicePath(configKey)
}

func intToString(value int) string {
	return strconv.Itoa(value)
}

func int64ToString(value int64) string {
	return strconv.FormatInt(value, 10)
}
