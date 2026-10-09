// Kept light: one spring grammar, each product's tempo, for SwiftUI (family kit, motion.md).
//
// The same four roles as springs.js (press, settle, glide, pop) on SwiftUI's own `Spring`, which
// is the same physical spring: Spring(duration: d, bounce: b) has stiffness (2π/d)² and damping
// 4π(1 − b)/d at mass 1, exactly springs.js `spring({ duration, bounce })`. Eat Map keeps the
// platform's springs (its tempo below is the system presets); the other tempos are here so a
// native capture or a future app can play a sibling's motion faithfully.
//
// Requires iOS 17 / macOS 14 (Spring, Animation.spring(_:)). Drop the file into the target; no
// package. Reduced motion: spatial springs become no animation (the change jumps to its end) and
// fades stay at 150 ms or less (motion.md §4), read from \.accessibilityReduceMotion.
//
// Usage:
//   .keptAnimation(.settle, value: isOpen)                       // Eat Map's tempo
//   .keptAnimation(.pop, tempo: .eatMap, value: didCompose)
//   withAnimation(KeptTempo.eatMap.animation(.settle)) { … }    // when you already know motion is allowed

import SwiftUI

/// The four roles of the grammar (family.md F1).
public enum KeptRole: CaseIterable, Sendable {
    /// Answers the finger: a press and its release.
    case press
    /// Ends every move: panels, reflow, a selection settling.
    case settle
    /// Carries you between places: sheets, large moves.
    case glide
    /// Rare and small: one glyph or one object, never a surface.
    case pop
}

/// One product's tempo: the spring each role plays. `nil` means "leave it to the system"
/// (a Button's own highlight, NavigationStack's own push).
public struct KeptTempo: Sendable {
    public var press: Spring?
    public var settle: Spring?
    public var glide: Spring?
    public var pop: Spring?

    public init(press: Spring?, settle: Spring?, glide: Spring?, pop: Spring?) {
        self.press = press
        self.settle = settle
        self.glide = glide
        self.pop = pop
    }

    public subscript(role: KeptRole) -> Spring? {
        switch role {
        case .press: press
        case .settle: settle
        case .glide: glide
        case .pop: pop
        }
    }

    /// The role as an Animation, or nil when the system should animate it itself.
    public func animation(_ role: KeptRole) -> Animation? {
        self[role].map { Animation.spring($0) }
    }

    /// Eat Map (estimated; confirm in the project): the platform's springs. Press and push are
    /// the system's own; .smooth settles; .bouncy only on compose.
    public static let eatMap = KeptTempo(press: nil, settle: .smooth, glide: nil, pop: .bouncy)

    /// Recto (shipped, apps/web/src/motion/springs.ts): zero bounce on every surface.
    public static let recto = KeptTempo(
        press: Spring(duration: 0.20, bounce: 0),
        settle: Spring(duration: 0.36, bounce: 0),
        glide: Spring(duration: 0.46, bounce: 0),
        pop: Spring(duration: 0.32, bounce: 0.25)
    )

    /// English Prep (equivalent: its CSS runs one ease today; these zero-bounce springs fit it).
    public static let englishPrep = KeptTempo(
        press: Spring(duration: 0.048, bounce: 0),
        settle: Spring(duration: 0.182, bounce: 0),
        glide: Spring(duration: 0.172, bounce: 0),
        pop: Spring(duration: 0.105, bounce: 0)
    )

    /// The portfolio (settle and pop shipped as --spring-ui and --spring-object; press and glide
    /// proposed in family.md §2.2).
    public static let portfolio = KeptTempo(
        press: Spring(mass: 1, stiffness: 600, damping: 49),
        settle: Spring(mass: 1, stiffness: 300, damping: 30),
        glide: Spring(mass: 1, stiffness: 170, damping: 26),
        pop: Spring(mass: 1, stiffness: 180, damping: 16)
    )
}

/// The fade that survives reduced motion (motion.md §4: perceptible, never longer than 150 ms).
public extension Animation {
    static let keptFade: Animation = .easeOut(duration: 0.15)
}

private struct KeptAnimation<V: Equatable>: ViewModifier {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let role: KeptRole
    let tempo: KeptTempo
    let value: V

    func body(content: Content) -> some View {
        // Reduced motion: the spatial change jumps; use .keptFade on opacity where a change must
        // stay visible. Otherwise the tempo's spring, or the system default where it has none.
        content.animation(reduceMotion ? nil : (tempo.animation(role) ?? .default), value: value)
    }
}

public extension View {
    /// Animate changes of `value` with the role's spring at the product's tempo.
    func keptAnimation<V: Equatable>(_ role: KeptRole, tempo: KeptTempo = .eatMap, value: V) -> some View {
        modifier(KeptAnimation(role: role, tempo: tempo, value: value))
    }
}
