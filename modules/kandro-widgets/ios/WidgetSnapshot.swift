import Foundation

struct KandroWidgetSnapshot: Codable {
  let schema: Int
  let generation: String
  let day: String
  let updatedAt: Double
  let timezoneOffset: Int
  let language: String
  let privacy: String
  let calories: Double?
  let protein: Double?
  let targetCalories: Double?
  let targetProtein: Double?

  static func dayKey(_ date: Date) -> String {
    let formatter = DateFormatter()
    formatter.calendar = Calendar(identifier: .gregorian)
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.timeZone = .current
    formatter.dateFormat = "yyyy-MM-dd"
    return formatter.string(from: date)
  }
  func valid(at now: Date) -> Bool {
    let values = [calories, protein, targetCalories, targetProtein].compactMap { $0 }
    return schema == 1 && UUID(uuidString: generation) != nil
      && ["de", "en"].contains(language) && ["actions", "shared"].contains(privacy)
      && updatedAt.isFinite && now.timeIntervalSince1970 - updatedAt >= -60
      && now.timeIntervalSince1970 - updatedAt < 7200
      && day == Self.dayKey(now)
      && timezoneOffset == -TimeZone.current.secondsFromGMT(for: now) / 60
      && values.allSatisfy { $0.isFinite && $0 >= 0 && $0 <= 10_000_000 }
      && (privacy != "shared" || (calories != nil && protein != nil))
      && (privacy != "actions" || values.isEmpty)
  }
  static func containerURL() -> URL? {
    guard let group = Bundle.main.object(forInfoDictionaryKey: "KandroAppGroup") as? String else { return nil }
    return FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group)
  }
  static func fileURL() -> URL? { containerURL()?.appendingPathComponent("today-v1.json") }
  static func read(at date: Date) -> KandroWidgetSnapshot? {
    guard let url = fileURL(), let data = try? Data(contentsOf: url), data.count <= 4096,
      let value = try? JSONDecoder().decode(Self.self, from: data), value.valid(at: date) else { return nil }
    return value
  }
}
