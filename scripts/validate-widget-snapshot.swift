import Foundation
@main struct WidgetSnapshotChecks {
  static func main() throws {
    let now = Date()
    func snapshot(_ changes: [String: Any] = [:]) throws -> KandroWidgetSnapshot {
      var data: [String: Any] = ["schema": 1, "generation": UUID().uuidString, "day": KandroWidgetSnapshot.dayKey(now), "updatedAt": now.timeIntervalSince1970, "timezoneOffset": -TimeZone.current.secondsFromGMT(for: now) / 60, "language": "de", "privacy": "shared", "calories": 522.4, "protein": 30.0, "targetCalories": 2100.0, "targetProtein": 110.0]
      data.merge(changes) { _, new in new }
      return try JSONDecoder().decode(KandroWidgetSnapshot.self, from: JSONSerialization.data(withJSONObject: data))
    }
    let good = try snapshot()
    assert(good.valid(at: now))
    for changes: [String: Any] in [["schema": 2], ["generation": "user@example.test"], ["day": "2000-01-01"], ["updatedAt": now.timeIntervalSince1970 - 7200], ["updatedAt": now.timeIntervalSince1970 + 61], ["timezoneOffset": 9999], ["language": "xx"], ["privacy": "unknown"], ["calories": -1], ["protein": NSNull()], ["privacy": "actions"]] {
      let invalid = try snapshot(changes); assert(!invalid.valid(at: now), "Accepted invalid snapshot: \(changes.keys)")
    }
    let noNumbers = try snapshot(["privacy": "actions", "calories": NSNull(), "protein": NSNull(), "targetCalories": NSNull(), "targetProtein": NSNull()])
    assert(noNumbers.valid(at: now))
    let untrusted = try snapshot(["token": "must not be copied", "mealNames": ["private"], "owner": "not allowed"])
    let encoded = try JSONSerialization.jsonObject(with: JSONEncoder().encode(untrusted)) as! [String: Any]
    assert(encoded["token"] == nil && encoded["mealNames"] == nil && encoded["owner"] == nil)
    let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: now)!
    assert(!good.valid(at: tomorrow))
    print("PASS native Swift snapshot: schema, UUID, language, privacy, missing/negative values, TTL/future clock, local date/timezone, no arbitrary fields; 15 assertions")
  }
}
