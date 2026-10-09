import WidgetKit
import SwiftUI

struct KandroEntry: TimelineEntry {
  let date: Date
  let snapshot: KandroWidgetSnapshot?
  var language: String { snapshot?.language ?? (Locale.preferredLanguages.first?.hasPrefix("de") == true ? "de" : "en") }
  var german: Bool { language == "de" }
}
struct KandroProvider: TimelineProvider {
  func placeholder(in context: Context) -> KandroEntry { KandroEntry(date: Date(), snapshot: nil) }
  func getSnapshot(in context: Context, completion: @escaping (KandroEntry) -> Void) { completion(KandroEntry(date: Date(), snapshot: context.isPreview ? nil : KandroWidgetSnapshot.read(at: Date()))) }
  func getTimeline(in context: Context, completion: @escaping (Timeline<KandroEntry>) -> Void) {
    let now = Date()
    let value = KandroWidgetSnapshot.read(at: now)
    let midnight = Calendar.current.date(byAdding: .day, value: 1, to: Calendar.current.startOfDay(for: now)) ?? now.addingTimeInterval(3600)
    let expiry = min(midnight, Date(timeIntervalSince1970: (value?.updatedAt ?? now.timeIntervalSince1970) + 7200))
    completion(Timeline(entries: [KandroEntry(date: now, snapshot: value), KandroEntry(date: expiry, snapshot: nil)], policy: .after(expiry)))
  }
}
struct KandroBackground: ViewModifier {
  @Environment(\.colorScheme) var scheme
  func body(content: Content) -> some View {
    let background = Color(red: scheme == .dark ? 0.063 : 0.961, green: scheme == .dark ? 0.071 : 0.953, blue: scheme == .dark ? 0.055 : 0.933)
    if #available(iOSApplicationExtension 17.0, *) { content.containerBackground(background, for: .widget) }
    else { content.padding().background(background) }
  }
}
private func captureURL(_ mode: String) -> URL { URL(string: "kandro://capture?mode=\(mode)")! }
// The same open-ring mark as the host, rendered as a vector in every tint mode.
private struct KandroWidgetMark: View {
  var body: some View {
    GeometryReader { g in
      let scale = g.size.width / 64
      ZStack {
        Path { path in
          path.addArc(center: CGPoint(x: 32 * scale, y: 32 * scale), radius: 22 * scale,
                      startAngle: .degrees(-45), endAngle: .degrees(225), clockwise: false)
        }.stroke(style: StrokeStyle(lineWidth: 6.5 * scale, lineCap: .round))
        Circle().frame(width: 9.6 * scale, height: 9.6 * scale)
          .position(x: 32 * scale, y: 7.5 * scale)
      }
    }.accessibilityHidden(true)
  }
}
struct TodayWidgetView: View {
  let entry: KandroEntry
  @Environment(\.widgetFamily) var family
  @Environment(\.colorScheme) var scheme
  private var text: Color { scheme == .dark ? Color(red: 0.957, green: 0.953, blue: 0.925) : Color(red: 0.078, green: 0.082, blue: 0.059) }
  private var accent: Color { scheme == .dark ? Color(red: 0.733, green: 0.863, blue: 0.557) : Color(red: 0.247, green: 0.322, blue: 0.2) }
  private func formatted(_ value: Double) -> String { value.formatted(.number.locale(Locale(identifier: entry.german ? "de_DE" : "en_GB")).precision(.fractionLength(0))) }
  private var shared: KandroWidgetSnapshot? { entry.snapshot?.privacy == "shared" ? entry.snapshot : nil }
  private var heading: some View {
    HStack(spacing: 6) {
      KandroWidgetMark().frame(width: 17, height: 17).foregroundStyle(accent).widgetAccentable()
      Text(verbatim: entry.german ? "Heute" : "Today").font(.subheadline.weight(.semibold))
    }.accessibilityElement(children: .combine).accessibilityLabel(entry.german ? "Kandro Heute" : "Kandro Today")
  }
  var body: some View {
    Group {
      if family == .systemMedium {
        HStack(alignment: .top, spacing: 16) {
          summary(small: false).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
          VStack(spacing: 8) {
            HStack(spacing: 8) {
              action("camera", entry.german ? "Foto" : "Photo", "photo")
              action("barcode.viewfinder", "Barcode", "barcode")
            }
            HStack(spacing: 8) {
              action("text.alignleft", "Text", "description")
              action("magnifyingglass", entry.german ? "Suchen" : "Search", "search")
            }
          }.frame(maxWidth: .infinity, maxHeight: .infinity)
        }
      } else {
        VStack(alignment: .leading, spacing: 6) {
          summary(small: true)
          Spacer(minLength: 0)
          Label { Text(verbatim: entry.german ? "Eintragen" : "Log food") } icon: { Image(systemName: "plus.circle.fill") }
            .font(.subheadline.weight(.semibold)).foregroundStyle(accent).widgetAccentable()
        }
      }
    }.foregroundStyle(text).modifier(KandroBackground()).widgetURL(captureURL("search"))
  }
  private func summary(small: Bool) -> some View {
    VStack(alignment: .leading, spacing: small ? 4 : 6) {
      heading
      if let value = shared, let calories = value.calories, let protein = value.protein {
        VStack(alignment: .leading, spacing: 1) {
          Text(formatted(calorieFigure(calories, value.targetCalories))).font(.system(size: small ? 32 : 36, weight: .semibold, design: .rounded))
            .monospacedDigit().lineLimit(1).minimumScaleFactor(0.8)
          Text(verbatim: calorieCaption(calories, value.targetCalories)).font(.caption).foregroundStyle(.secondary)
        }.accessibilityElement(children: .combine).privacySensitive()
        Text(verbatim: proteinLine(protein, value.targetProtein)).font(.subheadline.weight(.medium)).monospacedDigit().lineLimit(1).minimumScaleFactor(0.8).privacySensitive()
        if let target = value.targetCalories, target > 0 {
          GeometryReader { geometry in
            ZStack(alignment: .leading) {
              Capsule().fill(text.opacity(0.10))
              Capsule().fill(accent.opacity(0.65)).frame(width: geometry.size.width * min(1, max(0, calories / target)))
            }
          }.frame(height: 3).accessibilityLabel(entry.german ? "Tagesziel" : "Daily target")
            .accessibilityValue("\(formatted(calories)) / \(formatted(target)) kcal").privacySensitive()
        }
      } else {
        Spacer(minLength: 0)
        Text(verbatim: entry.german ? "Dein nächster Eintrag" : "Your next food entry")
          .font(.headline).fixedSize(horizontal: false, vertical: true)
        Text(verbatim: entry.german ? "In Kandro öffnen" : "Open in Kandro")
          .font(.caption).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
        if !small { Spacer(minLength: 0) }
      }
    }
  }
  // Same reading as the app's ring: what is left today, or how far over, never a bare total.
  private func calorieFigure(_ calories: Double, _ target: Double?) -> Double {
    guard let target = target, target > 0 else { return calories }
    return abs(target - calories)
  }
  private func calorieCaption(_ calories: Double, _ target: Double?) -> String {
    guard let target = target, target > 0 else { return entry.german ? "kcal erfasst" : "kcal logged" }
    if calories > target { return entry.german ? "kcal drüber" : "kcal over" }
    return entry.german ? "kcal übrig" : "kcal left"
  }
  private func proteinLine(_ protein: Double, _ target: Double?) -> String {
    guard let target = target, target > 0 else { return "\(formatted(protein)) g Protein" }
    let left = max(0, target - protein)
    if left.rounded() <= 0 { return entry.german ? "Protein geschafft" : "Protein done" }
    return entry.german ? "\(formatted(left)) g Protein übrig" : "\(formatted(left)) g protein left"
  }
  private func action(_ symbol: String, _ label: String, _ mode: String) -> some View {
    Link(destination: captureURL(mode)) {
      VStack(spacing: 5) {
        Image(systemName: symbol).font(.system(size: 21, weight: .medium))
        Text(verbatim: label).font(.caption.weight(.semibold)).fixedSize(horizontal: false, vertical: true)
      }.frame(maxWidth: .infinity, maxHeight: .infinity).frame(minHeight: 48)
        .foregroundStyle(accent).padding(.vertical, 3)
        .background(accent.opacity(scheme == .dark ? 0.12 : 0.07), in: RoundedRectangle(cornerRadius: 12))
        .contentShape(RoundedRectangle(cornerRadius: 12))
    }.accessibilityLabel(mode == "description" ? (entry.german ? "Mahlzeit beschreiben" : "Describe a meal") : label)
  }
}
struct ShortcutView: View {
  let entry: KandroEntry
  let photo: Bool
  @Environment(\.widgetFamily) var family
  var body: some View {
    let title = photo ? (entry.german ? "Foto scannen" : "Scan a meal") : (entry.german ? "Essen eintragen" : "Log food")
    Group {
      if family == .accessoryCircular { Image(systemName: photo ? "camera" : "plus.circle").font(.title2).accessibilityLabel(title) }
      else { Label(title, systemImage: photo ? "camera" : "plus.circle").font(.headline) }
    }.modifier(KandroBackground()).widgetURL(captureURL(photo ? "photo" : "search"))
  }
}
struct TodayWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "KandroToday", provider: KandroProvider()) { TodayWidgetView(entry: $0) }
      .configurationDisplayName("Kandro Today").description("Your day and a quick way to log food. Totals are optional in Kandro’s profile settings.")
      .supportedFamilies([.systemSmall, .systemMedium])
  }
}
struct EntryWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "KandroEntry", provider: KandroProvider()) { ShortcutView(entry: $0, photo: false) }
      .configurationDisplayName("Log food").description("Open food search in Kandro.").supportedFamilies([.accessoryCircular, .accessoryRectangular])
  }
}
struct PhotoWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "KandroPhoto", provider: KandroProvider()) { ShortcutView(entry: $0, photo: true) }
      .configurationDisplayName("Scan a meal").description("Open Kandro’s camera. You confirm every meal in the app.").supportedFamilies([.accessoryCircular, .accessoryRectangular])
  }
}
@main struct KandroWidgets: WidgetBundle { var body: some Widget { TodayWidget(); EntryWidget(); PhotoWidget() } }
