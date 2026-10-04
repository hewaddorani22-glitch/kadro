Pod::Spec.new do |s|
  s.name = 'KandroWidgetBridge'
  s.version = '1.0.0'
  s.summary = 'Private local WidgetKit snapshot bridge for Kandro'
  s.description = s.summary
  s.license = { :type => 'Proprietary' }
  s.author = 'Kandro'
  s.homepage = 'https://getkandro.com'
  s.source = { :path => '.' }
  s.platforms = { :ios => '15.1' }
  s.swift_version = '5.9'
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'WidgetKit'
  s.source_files = '**/*.swift'
end
