const fs = require('node:fs');
const path = require('node:path');
const { withInfoPlist, withEntitlementsPlist, withXcodeProject } = require('expo/config-plugins');
const plist = require('@expo/plist').default;
const PbxFile = require('xcode/lib/pbxFile');
const NAME = 'KandroWidgets';
const unquote = value => String(value ?? '').replace(/^"|"$/g, '');
module.exports = function withKandroWidgets(config) {
  const bundle = `${config.ios.bundleIdentifier}.widgets`;
  const group = `group.${config.ios.bundleIdentifier}.widgets`;
  config.extra ??= {}; config.extra.eas ??= {}; config.extra.eas.build ??= {}; config.extra.eas.build.experimental ??= {};
  const extensions = config.extra.eas.build.experimental.ios ??= {};
  const entry = { targetName: NAME, bundleIdentifier: bundle, entitlements: { 'com.apple.security.application-groups': [group], 'com.apple.developer.default-data-protection': 'NSFileProtectionComplete' } };
  const existing = (extensions.appExtensions ?? []).filter(item => item.targetName === NAME);
  if (existing.some(item => item.bundleIdentifier !== bundle)) throw new Error('Conflicting Kandro widget bundle identifier');
  extensions.appExtensions = [...(extensions.appExtensions ?? []).filter(item => item.targetName !== NAME), entry];
  config = withInfoPlist(config, mod => { mod.modResults.KandroAppGroup = group; return mod; });
  config = withEntitlementsPlist(config, mod => {
    mod.modResults['com.apple.security.application-groups'] = [...new Set([...(mod.modResults['com.apple.security.application-groups'] ?? []), group])]; return mod;
  });
  return withXcodeProject(config, mod => {
    const project = mod.modResults;
    const objects = project.hash.project.objects;
    const nativeTargets = Object.entries(objects.PBXNativeTarget).filter(([id]) => !id.endsWith('_comment'));
    const host = nativeTargets.find(([, target]) => unquote(target.productType) === 'com.apple.product-type.application');
    if (!host) throw new Error('Kandro host target missing');
    let target = nativeTargets.find(([, target]) => unquote(target.name) === NAME);
    const folder = path.join(mod.modRequest.platformProjectRoot, NAME);
    fs.mkdirSync(folder, { recursive: true });
    for (const file of ['KandroWidgets.swift', 'PrivacyInfo.xcprivacy']) fs.copyFileSync(path.join(mod.modRequest.projectRoot, 'widgets/ios', file), path.join(folder, file));
    fs.copyFileSync(path.join(mod.modRequest.projectRoot, 'modules/kandro-widgets/ios/WidgetSnapshot.swift'), path.join(folder, 'WidgetSnapshot.swift'));
    for (const language of ['de', 'en']) {
      fs.mkdirSync(path.join(folder, `${language}.lproj`), { recursive: true });
      fs.copyFileSync(path.join(mod.modRequest.projectRoot, 'widgets/ios', `${language}.lproj/Localizable.strings`), path.join(folder, `${language}.lproj/Localizable.strings`));
    }
    fs.writeFileSync(path.join(folder, 'Info.plist'), plist.build({ CFBundleDisplayName: 'Kandro', CFBundleIdentifier: '$(PRODUCT_BUNDLE_IDENTIFIER)', CFBundleExecutable: '$(EXECUTABLE_NAME)', CFBundleName: '$(PRODUCT_NAME)', CFBundlePackageType: 'XPC!', CFBundleShortVersionString: '$(MARKETING_VERSION)', CFBundleVersion: '$(CURRENT_PROJECT_VERSION)', KandroAppGroup: group, CFBundleLocalizations: ['en', 'de'], NSExtension: { NSExtensionPointIdentifier: 'com.apple.widgetkit-extension' } }));
    fs.writeFileSync(path.join(folder, `${NAME}.entitlements`), plist.build(entry.entitlements));
    if (!target) {
      const added = project.addTarget(NAME, 'app_extension', NAME, bundle);
      target = [added.uuid, added.pbxNativeTarget];
      const groupRef = project.addPbxGroup([], NAME, NAME).uuid;
      project.addToPbxGroup(groupRef, project.getFirstProject().firstProject.mainGroup);
      for (const [type, name] of [['PBXSourcesBuildPhase', 'Sources'], ['PBXFrameworksBuildPhase', 'Frameworks'], ['PBXResourcesBuildPhase', 'Resources']]) project.addBuildPhase([], type, name, target[0]);
      for (const file of ['KandroWidgets.swift', 'WidgetSnapshot.swift']) project.addSourceFile(file, { target: target[0] }, groupRef);
      const privacy = project.addFile('PrivacyInfo.xcprivacy', groupRef);
      privacy.uuid = project.generateUuid(); privacy.target = target[0];
      project.addToPbxBuildFileSection(privacy); project.addToPbxResourcesBuildPhase(privacy);
      const variant = project.pbxCreateVariantGroup('Localizable.strings');
      project.addToPbxGroup(variant, groupRef);
      const resource = { uuid: project.generateUuid(), fileRef: variant, basename: 'Localizable.strings', target: target[0] };
      project.addToPbxBuildFileSection(resource); project.addToPbxResourcesBuildPhase(resource);
      for (const language of ['de', 'en']) {
        const localized = new PbxFile(`${language}.lproj/Localizable.strings`);
        localized.fileRef = project.generateUuid(); localized.basename = language;
        project.addToPbxFileReferenceSection(localized); project.addToPbxVariantGroup(localized, variant);
        project.addKnownRegion(language);
      }
    }
    const settingsFor = id => objects.XCConfigurationList[objects.PBXNativeTarget[id].buildConfigurationList].buildConfigurations.map(ref => objects.XCBuildConfiguration[ref.value]);
    const hostSettings = settingsFor(host[0]);
    const hostInfoPath = path.join(mod.modRequest.platformProjectRoot, unquote(hostSettings[0].buildSettings.INFOPLIST_FILE));
    const hostInfo = plist.parse(fs.readFileSync(hostInfoPath, 'utf8'));
    const hostBuild = mod.ios.buildNumber ?? hostInfo.CFBundleVersion;
    for (const cfg of settingsFor(target[0])) {
      const hostCfg = hostSettings.find(c => c.name === cfg.name) ?? hostSettings[0];
      Object.assign(cfg.buildSettings, { PRODUCT_BUNDLE_IDENTIFIER: bundle, PRODUCT_NAME: '"$(TARGET_NAME)"', INFOPLIST_FILE: `${NAME}/Info.plist`, CODE_SIGN_ENTITLEMENTS: `${NAME}/${NAME}.entitlements`, DEVELOPMENT_TEAM: hostCfg.buildSettings.DEVELOPMENT_TEAM ?? mod.ios.appleTeamId, CODE_SIGN_STYLE: 'Automatic', SWIFT_VERSION: '5.0', IPHONEOS_DEPLOYMENT_TARGET: '16.0', TARGETED_DEVICE_FAMILY: '"1,2"', APPLICATION_EXTENSION_API_ONLY: 'YES', SKIP_INSTALL: 'YES', GENERATE_INFOPLIST_FILE: 'NO', MARKETING_VERSION: mod.version, CURRENT_PROJECT_VERSION: hostBuild === '$(CURRENT_PROJECT_VERSION)' ? hostCfg.buildSettings.CURRENT_PROJECT_VERSION : hostBuild ?? '1', LD_RUNPATH_SEARCH_PATHS: '"$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks"' });
    }
    return mod;
  });
};
