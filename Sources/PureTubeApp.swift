import SwiftUI

@main
struct PureTubeApp: App {
    init() {
        AudioSessionManager.shared.configure()
    }
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .preferredColorScheme(.dark)
        }
    }
}
