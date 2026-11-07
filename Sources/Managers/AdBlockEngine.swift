import Foundation
import WebKit

final class AdBlockEngine {
    static let shared = AdBlockEngine()
    
    private(set) var contentRuleList: WKContentRuleList?
    private(set) var userScripts: [WKUserScript] = []
    
    private init() {}
    
    func prepare(completion: @escaping () -> Void) {
        prepareUserScripts()
        compileRuleList {
            completion()
        }
    }
    
    private func loadFile(name: String, ext: String) -> String? {
        if let url = Bundle.main.url(forResource: name, withExtension: ext) {
            return try? String(contentsOf: url, encoding: .utf8)
        }
        for sub in ["Scripts", "Rules", "Resources/Scripts", "Resources/Rules"] {
            if let url = Bundle.main.url(forResource: name, withExtension: ext, subdirectory: sub) {
                return try? String(contentsOf: url, encoding: .utf8)
            }
        }
        return nil
    }
    
    private func prepareUserScripts() {
        var scripts: [WKUserScript] = []
        
        // 1. Core AdBlock script (Defuser & auto-skip)
        if let adblockCore = loadFile(name: "adblock_core", ext: "js") {
            let userScript = WKUserScript(
                source: adblockCore,
                injectionTime: .atDocumentStart,
                forMainFrameOnly: false
            )
            scripts.append(userScript)
        }
        
        // 2. Background Playback & PiP Enabler
        if let bgPlayback = loadFile(name: "background_playback", ext: "js") {
            let userScript = WKUserScript(
                source: bgPlayback,
                injectionTime: .atDocumentStart,
                forMainFrameOnly: false
            )
            scripts.append(userScript)
        }
        
        // 3. Native Gestures Engine (Double tap, Long press 2x, Swipe up/down)
        if let gesturesScript = loadFile(name: "youtube_gestures", ext: "js") {
            let userScript = WKUserScript(
                source: gesturesScript,
                injectionTime: .atDocumentEnd,
                forMainFrameOnly: false
            )
            scripts.append(userScript)
        }
        
        // 4. Cosmetic Rules (CSS injection)
        if let cssContent = loadFile(name: "cosmetic_rules", ext: "css") {
            let escapedCSS = cssContent
                .replacingOccurrences(of: "\\", with: "\\\\")
                .replacingOccurrences(of: "`", with: "\\`")
                .replacingOccurrences(of: "$", with: "\\$")
            
            let cssInjector = """
            (function() {
                function injectCSS() {
                    if (document.getElementById('puretube-cosmetic-rules')) return;
                    const style = document.createElement('style');
                    style.id = 'puretube-cosmetic-rules';
                    style.type = 'text/css';
                    style.appendChild(document.createTextNode(`\(escapedCSS)`));
                    (document.head || document.documentElement).appendChild(style);
                }
                injectCSS();
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', injectCSS);
                }
            })();
            """
            let userScript = WKUserScript(
                source: cssInjector,
                injectionTime: .atDocumentStart,
                forMainFrameOnly: false
            )
            scripts.append(userScript)
        }
        
        self.userScripts = scripts
    }
    
    private func compileRuleList(completion: @escaping () -> Void) {
        guard let rulesJSON = loadFile(name: "block_rules", ext: "json") else {
            print("[AdBlockEngine] Warning: block_rules.json not found")
            completion()
            return
        }
        
        WKContentRuleListStore.default().compileContentRuleList(
            forIdentifier: "PureTubeContentRules",
            encodedContentRuleList: rulesJSON
        ) { [weak self] ruleList, error in
            if let error = error {
                print("[AdBlockEngine] Failed to compile rule list: \(error.localizedDescription)")
            } else {
                self?.contentRuleList = ruleList
                print("[AdBlockEngine] Content rule list compiled successfully.")
            }
            completion()
        }
    }
}
