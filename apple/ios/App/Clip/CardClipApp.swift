import SwiftUI
import StoreKit
import PassKit

/*
 App Clip «البطاقة الرقمية»: يفتح بلا تثبيت من رابط dr-alfailakawi.com/card،
 أو من كود App Clip، أو من شريحة NFC. يعرض بطاقة د. أحمد بهوية الموقع نفسها:
 الصورة، الاسم، الصفة، زر حفظ جهة الاتصال، بطاقة Wallet، والروابط الرسمية.
 */

enum Brand {
    static let site = URL(string: "https://dr-alfailakawi.com")!
    static let vcard = URL(string: "https://dr-alfailakawi.com/card.vcf")!
    static let pass = URL(string: "https://dr-alfailakawi.com/card.pkpass")!
    static let cv = URL(string: "https://dr-alfailakawi.com/files/cv.pdf")!
    static let booking = URL(string: "https://schedule.dr-alfailakawi.com/")!

    static func dynamic(_ light: UInt32, _ dark: UInt32) -> Color {
        Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(hex: dark) : UIColor(hex: light) })
    }
    static let canvas = dynamic(0xFCFCFA, 0x0F1115)
    static let ink = dynamic(0x15161A, 0xECEAE4)
    static let soft = dynamic(0x5E6570, 0xB5B8BE)
    static let accent = dynamic(0x3E5C78, 0x84A9CA)
    static let onAccent = dynamic(0xFCFCFA, 0x0F1115)
    static let hair = dynamic(0xE3E3DF, 0x2A2D33)
}

extension UIColor {
    convenience init(hex: UInt32) {
        self.init(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255,
                  blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
    }
}

struct LinkItem: Identifiable {
    let id = UUID()
    let title: String
    let symbol: String
    let url: URL
}

let profileLinks: [LinkItem] = [
    LinkItem(title: "الموقع الرسمي", symbol: "globe", url: Brand.site),
    LinkItem(title: "LinkedIn", symbol: "person.crop.square", url: URL(string: "https://www.linkedin.com/in/prof-ahmad-alfailakawi-5922251a5")!),
    LinkItem(title: "X", symbol: "xmark", url: URL(string: "https://x.com/drahmadkw")!),
    LinkItem(title: "Instagram", symbol: "camera", url: URL(string: "https://www.instagram.com/drahmadkw/")!),
    LinkItem(title: "YouTube", symbol: "play.rectangle", url: URL(string: "https://youtube.com/@drahmadalfailakawi")!),
    LinkItem(title: "Google Scholar", symbol: "graduationcap", url: URL(string: "https://scholar.google.com/citations?user=WVAtInIAAAAJ&hl=en")!),
]

@main
struct CardClipApp: App {
    var body: some Scene {
        WindowGroup {
            CardView()
                .environment(\.layoutDirection, .rightToLeft)
                .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { _ in }
        }
    }
}

struct CardView: View {
    @Environment(\.openURL) private var openURL
    @State private var appeared = false
    @State private var ring: CGFloat = 0
    @State private var saved = false
    @State private var passData: Data?
    @State private var showOverlay = false

    var body: some View {
        ZStack {
            Brand.canvas.ignoresSafeArea()
            ScrollView {
                VStack(spacing: 0) {
                    portrait
                        .padding(.top, 56)

                    Text("د. أحمد حسين الفيلكاوي")
                        .font(.system(size: 28, weight: .bold, design: .serif))
                        .foregroundStyle(Brand.ink)
                        .multilineTextAlignment(.center)
                        .padding(.top, 26)
                        .reveal(appeared, delay: 0.35)

                    Text("أستاذ تكنولوجيا التعليم والذكاء الاصطناعي")
                        .font(.system(size: 15, weight: .light))
                        .foregroundStyle(Brand.soft)
                        .multilineTextAlignment(.center)
                        .padding(.top, 8)
                        .reveal(appeared, delay: 0.45)

                    Button(action: saveContact) {
                        Label(saved ? "حُفظت جهة الاتصال" : "احفظ جهة الاتصال",
                              systemImage: saved ? "checkmark" : "person.crop.circle.badge.plus")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(Brand.onAccent)
                            .padding(.horizontal, 30)
                            .frame(height: 52)
                            .background(Capsule().fill(Brand.accent))
                    }
                    .buttonStyle(Pressable())
                    .padding(.top, 30)
                    .reveal(appeared, delay: 0.6)

                    Text("تُضاف إلى جهات اتصالك مع الصورة والروابط.")
                        .font(.system(size: 12))
                        .foregroundStyle(Brand.soft.opacity(0.8))
                        .padding(.top, 10)
                        .reveal(appeared, delay: 0.65)

                    if let passData {
                        WalletButton(data: passData)
                            .frame(height: 48)
                            .padding(.top, 18)
                            .padding(.horizontal, 40)
                            .transition(.opacity)
                    }

                    VStack(spacing: 10) {
                        ForEach(Array(profileLinks.enumerated()), id: \.element.id) { index, item in
                            LinkRow(item: item) { openURL(item.url) }
                                .reveal(appeared, delay: 0.75 + Double(index) * 0.06)
                        }
                    }
                    .padding(.top, 34)

                    HStack(spacing: 12) {
                        Chip(title: "احجز لقاءً", filled: true) { openURL(Brand.booking) }
                        Chip(title: "السيرة الذاتية", filled: false) { openURL(Brand.cv) }
                    }
                    .padding(.top, 26)
                    .reveal(appeared, delay: 1.15)

                    Text("dr-alfailakawi.com")
                        .font(.system(size: 12, design: .rounded))
                        .foregroundStyle(Brand.soft.opacity(0.7))
                        .environment(\.layoutDirection, .leftToRight)
                        .padding(.vertical, 36)
                }
                .frame(maxWidth: 440)
                .padding(.horizontal, 22)
                .frame(maxWidth: .infinity)
            }
        }
        .appStoreOverlay(isPresented: $showOverlay) {
            SKOverlay.AppClipConfiguration(position: .bottom)
        }
        .task {
            UIImpactFeedbackGenerator(style: .soft).impactOccurred()
            withAnimation(.easeOut(duration: 0.6)) { appeared = true }
            withAnimation(.easeInOut(duration: 1.4).delay(0.15)) { ring = 1 }
            await loadPass()
            try? await Task.sleep(nanoseconds: 4_000_000_000)
            showOverlay = true
        }
    }

    private var portrait: some View {
        ZStack {
            Circle()
                .trim(from: 0, to: ring)
                .stroke(Brand.accent, style: StrokeStyle(lineWidth: 1.6, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .frame(width: 148, height: 148)
            Image("Portrait")
                .resizable()
                .scaledToFill()
                .frame(width: 132, height: 132)
                .clipShape(Circle())
                .overlay(Circle().stroke(Brand.hair, lineWidth: 0.5))
                .scaleEffect(appeared ? 1 : 0.86)
                .opacity(appeared ? 1 : 0)
                .animation(.spring(response: 0.7, dampingFraction: 0.78), value: appeared)
        }
        .accessibilityHidden(true)
    }

    private func saveContact() {
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        openURL(Brand.vcard)
        withAnimation { saved = true }
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.6) { withAnimation { saved = false } }
    }

    private func loadPass() async {
        guard PKAddPassesViewController.canAddPasses() else { return }
        guard let (data, response) = try? await URLSession.shared.data(from: Brand.pass),
              let http = response as? HTTPURLResponse, http.statusCode == 200,
              (try? PKPass(data: data)) != nil else { return }
        withAnimation(.easeOut(duration: 0.4)) { passData = data }
    }
}

struct LinkRow: View {
    let item: LinkItem
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: item.symbol)
                    .font(.system(size: 14))
                    .foregroundStyle(Brand.soft)
                    .frame(width: 34, height: 34)
                    .overlay(Circle().stroke(Brand.hair, lineWidth: 1))
                Text(item.title)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Brand.ink)
                Spacer()
                Image(systemName: "arrow.left")
                    .font(.system(size: 13))
                    .foregroundStyle(Brand.soft)
            }
            .padding(.horizontal, 18)
            .frame(height: 60)
            .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(Brand.canvas))
            .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(Brand.hair, lineWidth: 1))
        }
        .buttonStyle(Pressable())
    }
}

struct Chip: View {
    let title: String
    let filled: Bool
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(filled ? Brand.accent : Brand.soft)
                .padding(.horizontal, 20)
                .frame(height: 40)
                .overlay(Capsule().stroke(filled ? Brand.accent : Brand.hair, lineWidth: 1))
        }
        .buttonStyle(Pressable())
    }
}

struct Pressable: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.easeOut(duration: 0.15), value: configuration.isPressed)
    }
}

struct WalletButton: UIViewRepresentable {
    let data: Data
    func makeCoordinator() -> Coordinator { Coordinator(data: data) }
    func makeUIView(context: Context) -> PKAddPassButton {
        let button = PKAddPassButton(addPassButtonStyle: .black)
        button.addTarget(context.coordinator, action: #selector(Coordinator.add), for: .touchUpInside)
        return button
    }
    func updateUIView(_ uiView: PKAddPassButton, context: Context) {}

    final class Coordinator: NSObject {
        let data: Data
        init(data: Data) { self.data = data }
        @objc func add() {
            guard let pass = try? PKPass(data: data),
                  let controller = PKAddPassesViewController(pass: pass),
                  let root = UIApplication.shared.connectedScenes
                    .compactMap({ ($0 as? UIWindowScene)?.keyWindow?.rootViewController }).first
            else { return }
            root.present(controller, animated: true)
        }
    }
}

extension View {
    func reveal(_ shown: Bool, delay: Double) -> some View {
        self.opacity(shown ? 1 : 0)
            .offset(y: shown ? 0 : 14)
            .animation(.easeOut(duration: 0.6).delay(delay), value: shown)
    }
}
