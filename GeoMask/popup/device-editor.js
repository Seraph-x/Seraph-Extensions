"use strict";
const DEVICE_INPUTS = [
  "system",
  "profile",
  "ua-ch",
  "ch-browser",
  "ch-platform-version",
  "ch-wow64",
];
const deviceProfileHistory = new Map();
function deviceElement(prefix, name) {
  return $(prefix + "-" + name);
}
function fillDeviceOptions(select, entries, value) {
  select.replaceChildren();
  for (const [id, label] of entries) {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = label;
    select.append(option);
  }
  select.value = value;
}
function deviceProfile(prefix) {
  const selected = deviceElement(prefix, "profile").value;
  return (
    selected ||
    (prefix === "id" && !deviceElement(prefix, "system").value
      ? settings.fp.profile
      : "")
  );
}
function deviceMode(prefix) {
  return deviceElement(prefix, "ua-ch").value || settings.fp.uaCH;
}
function populateDeviceProfiles(prefix, selected = "") {
  const system = deviceElement(prefix, "system").value;
  const entries = system
    ? [
        ["", "请选择该系统的芯片 / 显卡组合"],
        ...GeoMaskConfig.profileOptions(system).map((item) => [
          item.id,
          item.label,
        ]),
      ]
    : [["", "继承全局设备档案"]];
  fillDeviceOptions(deviceElement(prefix, "profile"), entries, selected);
}
function deviceDefaults(profileID) {
  const preset = GeoMaskConfig.PRESETS[profileID];
  if (!preset) return {};
  return {
    browser: profileID === "win-edge" ? "edge" : "chrome",
    platformVersion: preset.uaData.platformVersion,
    wow64: false,
  };
}
function renderDeviceEditor(prefix, fp, draft = null) {
  const get = (name, value) => draft?.[prefix + "-" + name] ?? value;
  const inherited = prefix === "id" && !fp.profile;
  deviceElement(prefix, "system").value = get(
    "system",
    inherited ? "" : GeoMaskConfig.PRESETS[fp.profile]?.uaData.platform || "",
  );
  populateDeviceProfiles(prefix, get("profile", fp.profile || ""));
  deviceElement(prefix, "ua-ch").value = get(
    "ua-ch",
    fp.uaCH || (prefix === "id" ? "" : "native"),
  );
  const defaults = deviceDefaults(deviceProfile(prefix));
  const fields =
    fp.uaCHFields ||
    (prefix === "id" && !fp.uaCH ? settings.fp.uaCHFields : null) ||
    {};
  for (const [name, key] of [
    ["ch-browser", "browser"],
    ["ch-platform-version", "platformVersion"],
    ["ch-wow64", "wow64"],
  ]) {
    deviceElement(prefix, name).value = String(
      get(name, fields[key] ?? defaults[key] ?? ""),
    );
  }
  refreshDeviceEditor(prefix);
  if (deviceProfile(prefix))
    deviceProfileHistory.set(prefix, deviceProfile(prefix));
}
function collectUAFields(prefix) {
  const preset = GeoMaskConfig.PRESETS[deviceProfile(prefix)];
  if (!preset) throw new Error("请先选择设备系统和芯片档案");
  return {
    browser: deviceElement(prefix, "ch-browser").value,
    platform: deviceElement(prefix, "ch-platform").value,
    platformVersion: deviceElement(prefix, "ch-platform-version").value.trim(),
    architecture: deviceElement(prefix, "ch-architecture").value,
    bitness: deviceElement(prefix, "ch-bitness").value,
    mobile: false,
    model: "",
    wow64: deviceElement(prefix, "ch-wow64").value === "true",
  };
}
function collectDeviceConfiguration(prefix, existing = {}) {
  const fp = { ...existing };
  const selected = deviceElement(prefix, "profile").value;
  if (!selected && (prefix === "fp" || deviceElement(prefix, "system").value))
    throw new Error("请为所选系统选择芯片 / 显卡组合");
  if (selected) fp.profile = selected;
  else delete fp.profile;
  const mode = deviceElement(prefix, "ua-ch").value;
  if (mode) fp.uaCH = mode;
  else {
    delete fp.uaCH;
    delete fp.uaCHFields;
  }
  if (mode === "custom") fp.uaCHFields = collectUAFields(prefix);
  if (mode === "profile") delete fp.uaCHFields;
  return fp;
}
function refreshDeviceEditor(prefix) {
  const preset = GeoMaskConfig.PRESETS[deviceProfile(prefix)];
  const mode = deviceMode(prefix);
  const custom = deviceElement(prefix, "ua-ch").value === "custom";
  deviceElement(prefix, "ch-fields").hidden = !custom;
  for (const [name, key] of [
    ["ch-platform", "platform"],
    ["ch-architecture", "architecture"],
    ["ch-bitness", "bitness"],
  ]) {
    const value = preset?.uaData[key] || "";
    deviceElement(prefix, name).value = value || "请选择芯片档案";
  }
  const canWow =
    preset?.uaData.platform === "Windows" &&
    preset.uaData.architecture === "x86";
  deviceElement(prefix, "ch-wow64").querySelector(
    'option[value="true"]',
  ).disabled = !canWow;
  deviceElement(prefix, "ch-wow64-row").hidden = !canWow;
  const status = deviceElement(prefix, "ch-status");
  const processing = !!(
    settings.enabled &&
    (prefix === "id"
      ? settings.fp.enabled && $("id-fp-mode").value !== "off"
      : $("fp-enabled").checked)
  );
  const effectiveFP = {
    ...settings.fp,
    ...collectDeviceConfigurationForPreview(prefix),
  };
  deviceElement(prefix, "device-summary").textContent =
    '编辑预览：'+GeoMaskPanel.fingerprintSummary(effectiveFP);
  status.className = "hint";
  const nativeText = nativeInfo?.available
    ? nativeInfo.platform +
      " / " +
      nativeInfo.architecture +
      " / " +
      nativeInfo.bitness +
      " 位"
    : nativeInfo?.error || "尚未获得原生 UA-CH";
  try {
    if (!preset)
      throw new Error("请选择芯片 / 显卡组合；系统切换不会自动保存。");
    if (mode === "native") {
      const issues = GeoMaskConfig.configurationIssues(
        {
          fp: {
            ...settings.fp,
            enabled: processing,
            ...collectDeviceConfiguration(prefix),
            uaCH: "native",
          },
        },
        nativeInfo,
      );
      status.textContent =
        "UA 和 UA-CH 均保留原生：" +
        nativeText +
        "。" +
        (issues[0] ||
          (processing
            ? "当前档案的系统和架构与原生值匹配。"
            : "设备与指纹处理关闭，所选硬件档案不应用。"));
      if (issues.length) status.className = "hint error-text";
      deviceElement(prefix, "ch-preview").textContent =
        "原生 UA：" +
        (nativeInfo?.ua || "待读取") +
        "\n" +
        JSON.stringify(nativeInfo, null, 2);
      return;
    }
    const fields=mode==='custom' ? (custom ? collectUAFields(prefix) : settings.fp.uaCHFields) : {};
    const resolved = GeoMaskConfig.resolvePreset(
      deviceProfile(prefix),
      GeoMaskConfig.browserVersion(),
      GeoMaskConfig.PRESETS,
      fields,
    );
    deviceElement(prefix, "ch-version").textContent =
      "Chromium " +
      resolved.uaData.chromiumVersion +
      "；浏览器 " +
      resolved.uaData.uaFullVersion +
      "（自动同步，不独立填写）";
    deviceElement(prefix, "ch-preview").textContent =
      resolved.ua + "\n\n" + JSON.stringify(resolved.uaData, null, 2);
    const modeMessage =
      mode === "profile"
        ? "使用整套档案默认标识。"
        : custom
          ? "品牌与系统联动，Chromium 版本跟随真实浏览器。"
          : "继承全局标识；设备档案仍参与搭配校验。";
    status.textContent =
      (processing ? "" : "处理已关闭；下方仅预览配置。") + modeMessage;
  } catch (error) {
    status.className = "hint error-text";
    status.textContent = error.message;
    deviceElement(prefix, "ch-preview").textContent =
      "配置尚未有效：" + error.message;
  }
}
function setupDeviceControls(prefix, markDirty) {
  for (const name of DEVICE_INPUTS)
    deviceElement(prefix, name).addEventListener("input", () => {
      if (name === "system") populateDeviceProfiles(prefix);
      if (name === "profile") {
        const profileID = deviceProfile(prefix);
        const preset = GeoMaskConfig.PRESETS[profileID];
        if (preset) {
          const previousID = deviceProfileHistory.get(prefix);
          const transition = GeoMaskPanel.deviceTransition({
            previousSystem:
              GeoMaskConfig.PRESETS[previousID]?.uaData.platform ||
              preset.uaData.platform,
            nextSystem: preset.uaData.platform,
            platformVersion: deviceElement(prefix, "ch-platform-version").value,
            previousDefaultVersion: deviceDefaults(previousID).platformVersion,
            defaultVersion: deviceDefaults(profileID).platformVersion,
            wow64: deviceElement(prefix, "ch-wow64").value,
          });
          const changed =
            transition.platformVersion !==
            deviceElement(prefix, "ch-platform-version").value;
          deviceElement(prefix, "ch-platform-version").value =
            transition.platformVersion;
          deviceElement(prefix, "ch-wow64").value = transition.wow64;
          deviceElement(prefix, "device-note").textContent = changed
            ? "已联动更新档案默认平台版本；尚未保存，可继续修改。"
            : "已保留手动平台版本；保存前会校验它与所选芯片是否匹配。";
          deviceProfileHistory.set(prefix, profileID);
        }
      }
      if (
        name === "ua-ch" &&
        deviceElement(prefix, "ua-ch").value === "custom"
      ) {
        const defaults = deviceDefaults(deviceProfile(prefix));
        if (!deviceElement(prefix, "ch-browser").value)
          deviceElement(prefix, "ch-browser").value =
            defaults.browser || "chrome";
        if (!deviceElement(prefix, "ch-platform-version").value)
          deviceElement(prefix, "ch-platform-version").value =
            defaults.platformVersion || "";
      }
      refreshDeviceEditor(prefix);
      markDirty();
    });
  if (prefix === "id")
    $("id-fp-mode").addEventListener("input", () => refreshDeviceEditor("id"));
}
function collectDeviceConfigurationForPreview(prefix) {
  const mode = deviceMode(prefix);
  const profile = deviceProfile(prefix);
  return {
    profile,
    uaCH: mode,
    uaCHFields:
      mode === "custom"
        ? deviceElement(prefix, "ua-ch").value === "custom"
          ? { browser: deviceElement(prefix, "ch-browser").value }
          : settings.fp.uaCHFields
        : {},
  };
}
