import SwiftUI
import WebKit
import Combine

enum UserAgentMode: String, CaseIterable, Identifiable {
    case desktop = "iPad Desktop"
    case mobile = "Tablet Mobile"
    
    var id: String { rawValue }
    
    var userAgentString: String {
        switch self {
        case .desktop:
            // High-fidelity Safari on macOS UA to trigger YouTube's desktop grid and 4K options
            return "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15"
        case .mobile:
            // Standard iPad Mobile UA
            return "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
        }
    }
}

@MainActor
final class WebViewModel: ObservableObject {
    @Published var canGoBack: Bool = false
    @Published var canGoForward: Bool = false
    @Published var isLoading: Bool = false
    @Published var estimatedProgress: Double = 0.0
    @Published var currentTitle: String = "YouTube"
    @Published var currentURL: URL? = URL(string: "https://www.youtube.com")
    @Published var blockedCount: Int = 0
    @Published var isZenMode: Bool = false
    @Published var userAgentMode: UserAgentMode = .desktop
    @Published var isReady: Bool = false
    
    weak var webView: WKWebView?
    
    init() {
        AdBlockEngine.shared.prepare { [weak self] in
            Task { @MainActor in
                self?.isReady = true
            }
        }
    }
    
    func goBack() {
        webView?.goBack()
    }
    
    func goForward() {
        webView?.goForward()
    }
    
    func reload() {
        webView?.reload()
    }
    
    func goHome() {
        if let url = URL(string: "https://www.youtube.com") {
            webView?.load(URLRequest(url: url))
        }
    }
    
    func requestPiP() {
        webView?.evaluateJavaScript("window.__pureTubeRequestPiP && window.__pureTubeRequestPiP();", completionHandler: nil)
    }
    
    func requestFullscreen() {
        webView?.evaluateJavaScript("window.__pureTubeEnterFullscreen && window.__pureTubeEnterFullscreen();", completionHandler: nil)
    }
    
    func togglePlay() {
        webView?.evaluateJavaScript("window.__pureTubeTogglePlay && window.__pureTubeTogglePlay();", completionHandler: nil)
    }
    
    func seek(delta: Double) {
        webView?.evaluateJavaScript("window.__pureTubeSeek && window.__pureTubeSeek(\(delta));", completionHandler: nil)
    }
    
    func switchUserAgent(to mode: UserAgentMode) {
        guard mode != userAgentMode else { return }
        userAgentMode = mode
        webView?.customUserAgent = mode.userAgentString
        webView?.reload()
    }
    
    func incrementBlockedCount() {
        blockedCount += 1
    }
    
    func clearBrowsingData() {
        let types = WKWebsiteDataStore.allWebsiteDataTypes()
        let date = Date(timeIntervalSince1970: 0)
        WKWebsiteDataStore.default().removeData(ofTypes: types, modifiedSince: date) { [weak self] in
            Task { @MainActor in
                self?.blockedCount = 0
                self?.goHome()
            }
        }
    }
}
