import SwiftUI
import WebKit

struct YouTubeWebView: UIViewRepresentable {
    @ObservedObject var viewModel: WebViewModel
    
    func makeCoordinator() -> Coordinator {
        Coordinator(viewModel: viewModel)
    }
    
    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        configuration.allowsPictureInPictureMediaPlayback = true
        configuration.allowsAirPlayForMediaPlayback = true
        
        let userContentController = WKUserContentController()
        
        // Add AdBlock scripts
        for script in AdBlockEngine.shared.userScripts {
            userContentController.addUserScript(script)
        }
        
        // Add Content Blocker Rules
        if let ruleList = AdBlockEngine.shared.contentRuleList {
            userContentController.add(ruleList)
        }
        
        // Add script message handler for ad telemetry
        userContentController.add(context.coordinator, name: "pureTubeAdBlock")
        
        configuration.userContentController = userContentController
        
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.contentInsetAdjustmentBehavior = .automatic
        webView.customUserAgent = viewModel.userAgentMode.userAgentString
        
        // Add pull-to-refresh for iPad
        let refreshControl = UIRefreshControl()
        refreshControl.addTarget(context.coordinator, action: #selector(Coordinator.handleRefreshControl(_:)), for: .valueChanged)
        webView.scrollView.refreshControl = refreshControl
        
        context.coordinator.setupObservers(for: webView)
        viewModel.webView = webView
        
        if let url = viewModel.currentURL {
            var request = URLRequest(url: url)
            request.timeoutInterval = 30
            webView.load(request)
        }
        
        return webView
    }
    
    func updateUIView(_ uiView: WKWebView, context: Context) {
        // UI updates driven via Coordinator & ViewModel
    }
    
    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
        var viewModel: WebViewModel
        private var observations: [NSKeyValueObservation] = []
        private var internalBypassURL: URL?
        
        init(viewModel: WebViewModel) {
            self.viewModel = viewModel
            super.init()
        }
        
        func setupObservers(for webView: WKWebView) {
            observations.append(webView.observe(\.canGoBack, options: [.new]) { [weak self] view, _ in
                Task { @MainActor in self?.viewModel.canGoBack = view.canGoBack }
            })
            
            observations.append(webView.observe(\.canGoForward, options: [.new]) { [weak self] view, _ in
                Task { @MainActor in self?.viewModel.canGoForward = view.canGoForward }
            })
            
            observations.append(webView.observe(\.isLoading, options: [.new]) { [weak self] view, _ in
                Task { @MainActor in
                    self?.viewModel.isLoading = view.isLoading
                    if !view.isLoading {
                        view.scrollView.refreshControl?.endRefreshing()
                    }
                }
            })
            
            observations.append(webView.observe(\.estimatedProgress, options: [.new]) { [weak self] view, _ in
                Task { @MainActor in self?.viewModel.estimatedProgress = view.estimatedProgress }
            })
            
            observations.append(webView.observe(\.title, options: [.new]) { [weak self] view, _ in
                Task { @MainActor in
                    if let title = view.title, !title.isEmpty {
                        self?.viewModel.currentTitle = title
                    }
                }
            })
            
            observations.append(webView.observe(\.url, options: [.new]) { [weak self] view, _ in
                Task { @MainActor in
                    if let url = view.url {
                        self?.viewModel.currentURL = url
                    }
                }
            })
        }
        
        @objc func handleRefreshControl(_ sender: UIRefreshControl) {
            viewModel.webView?.reload()
        }
        
        // MARK: - WKNavigationDelegate (Prevent App Redirection & Universal Links)
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.allow)
                return
            }
            
            let scheme = url.scheme?.lowercased() ?? ""
            let host = url.host?.lowercased() ?? ""
            let currentHost = webView.url?.host?.lowercased() ?? ""
            let isMainFrame = navigationAction.targetFrame?.isMainFrame ?? false
            
            // 1. If this navigation was initiated programmatically to bypass iOS Universal Links:
            if let bypass = internalBypassURL {
                if bypass == url || bypass.host == url.host {
                    internalBypassURL = nil
                    decisionHandler(.allow)
                    return
                }
            }
            
            // 2. Intercept and block external app schemes (vnd.youtube, youtube, intent, googlechrome)
            if scheme == "vnd.youtube" || scheme == "youtube" || scheme == "intent" || scheme == "googlechrome" || scheme == "googlechromes" {
                print("[PureTube Navigation] Intercepted external app scheme redirect: \(url.absoluteString)")
                let target = convertToHttps(url: url) ?? URL(string: "https://www.youtube.com")!
                internalBypassURL = target
                decisionHandler(.cancel)
                webView.load(URLRequest(url: target))
                return
            }
            
            // 3. Subframes / Iframes: ALWAYS allow without interfering
            // Google Accounts uses hidden background iframes (e.g. accounts.youtube.com/accounts/CheckConnection)
            // Intercepting or loading iframe URLs in the main webView causes white screen!
            if !isMainFrame && (scheme == "http" || scheme == "https") {
                decisionHandler(.allow)
                return
            }
            
            // 4. Handle target="_blank" links (popup or new tab)
            if navigationAction.targetFrame == nil {
                if scheme == "http" || scheme == "https" {
                    let urlStr = url.absoluteString
                    if !urlStr.isEmpty && urlStr != "about:blank" {
                        decisionHandler(.cancel)
                        webView.load(navigationAction.request)
                        return
                    }
                }
                decisionHandler(.allow)
                return
            }
            
            // 5. Handle HTTP/HTTPS navigations in Main Frame
            if scheme == "http" || scheme == "https" {
                // Prevent iOS Universal Links from handing off to the installed YouTube App:
                // When transitioning from accounts.google.com back to youtube.com after login,
                // iOS tries to launch the native app.
                // We bypass this by cancelling the OS handoff and loading programmatically.
                let isYouTubeDomain = host.contains("youtube.com") || host.contains("youtu.be")
                let isFromNonYouTube = !currentHost.isEmpty && !currentHost.contains("youtube.com") && !currentHost.contains("youtu.be")
                let isAuthEndpoint = host.contains("accounts.google.com") || host.contains("accounts.youtube.com")
                
                if isYouTubeDomain && isFromNonYouTube && isMainFrame && !isAuthEndpoint {
                    print("[PureTube Navigation] Preventing Universal Link handoff from \(currentHost) to \(host). Loading internally.")
                    internalBypassURL = url
                    decisionHandler(.cancel)
                    webView.load(navigationAction.request)
                    return
                }
                
                decisionHandler(.allow)
                return
            }
            
            // Block all other unknown schemes (like itms-apps, etc.) to keep user sandboxed
            decisionHandler(.cancel)
        }
        
        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            let nsError = error as NSError
            if nsError.code == NSURLErrorCancelled { return }
            print("[PureTube WebKit] Navigation failed: \(error.localizedDescription)")
        }
        
        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            let nsError = error as NSError
            if nsError.code == NSURLErrorCancelled { return }
            print("[PureTube WebKit] Provisional navigation failed: \(error.localizedDescription)")
        }
        
        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
            print("[PureTube WebKit] WebContent process terminated, reloading...")
            webView.reload()
        }
        
        private func convertToHttps(url: URL) -> URL? {
            let urlString = url.absoluteString
            
            // Case 1: vnd.youtube://...
            if urlString.hasPrefix("vnd.youtube://") {
                let rest = String(urlString.dropFirst("vnd.youtube://".count))
                if rest.hasPrefix("http://") || rest.hasPrefix("https://") {
                    return URL(string: rest)
                } else if rest.contains("youtube.com") {
                    return URL(string: "https://" + rest)
                } else if rest.hasPrefix("watch?") || rest.hasPrefix("channel/") || rest.hasPrefix("user/") || rest.hasPrefix("shorts/") {
                    return URL(string: "https://www.youtube.com/" + rest)
                } else if !rest.isEmpty && !rest.contains("/") && !rest.contains("?") {
                    return URL(string: "https://www.youtube.com/watch?v=\(rest)")
                }
            }
            
            // Case 2: vnd.youtube:...
            if urlString.hasPrefix("vnd.youtube:") {
                let rest = String(urlString.dropFirst("vnd.youtube:".count))
                if rest.hasPrefix("//") {
                    let sub = String(rest.dropFirst(2))
                    return URL(string: "https://www.youtube.com/" + sub)
                } else if !rest.isEmpty {
                    return URL(string: "https://www.youtube.com/watch?v=\(rest)")
                }
            }
            
            // Case 3: youtube://...
            if urlString.hasPrefix("youtube://") {
                let rest = String(urlString.dropFirst("youtube://".count))
                if rest.hasPrefix("http://") || rest.hasPrefix("https://") {
                    return URL(string: rest)
                }
                return URL(string: "https://www.youtube.com/" + rest)
            }
            
            return URL(string: "https://www.youtube.com")
        }
        
        // MARK: - WKScriptMessageHandler
        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "pureTubeAdBlock" else { return }
            Task { @MainActor in
                self.viewModel.incrementBlockedCount()
            }
        }
        
        // MARK: - WKUIDelegate (Handle target="_blank" links in same view)
        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
            if navigationAction.targetFrame == nil, let url = navigationAction.request.url {
                let urlStr = url.absoluteString
                if !urlStr.isEmpty && urlStr != "about:blank" {
                    webView.load(navigationAction.request)
                }
            }
            return nil
        }
    }
}
