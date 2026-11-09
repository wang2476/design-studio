// Design Studio as its own Mac app: one WebKit window on the local dev server.
// Starts `pnpm dev` if nothing answers on the port, and stops only a server it started.
// Build: mac/build.sh
import AppKit
import WebKit

// StudioURL (set at build time) points at another Mac's hosted studio; empty means run it here.
let remote = (Bundle.main.object(forInfoDictionaryKey: "StudioURL") as? String).flatMap { $0.isEmpty ? nil : URL(string: $0) }
let home = remote ?? URL(string: "http://localhost:5173/")!
let repo = Bundle.main.object(forInfoDictionaryKey: "StudioRepo") as? String ?? ""

@main
@MainActor
final class App: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate {
    var window: NSWindow!
    var web: WKWebView!
    var server: Process?

    static func main() {
        let app = NSApplication.shared
        let delegate = App()
        app.delegate = delegate
        app.setActivationPolicy(.regular)
        app.run()
    }

    func applicationDidFinishLaunching(_ note: Notification) {
        web = WKWebView(frame: .zero, configuration: WKWebViewConfiguration())
        web.navigationDelegate = self
        web.uiDelegate = self
        web.isInspectable = true  // right-click → Inspect Element
        web.allowsBackForwardNavigationGestures = true

        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1440, height: 900),
                          styleMask: [.titled, .closable, .miniaturizable, .resizable],
                          backing: .buffered, defer: false)
        window.title = "Design Studio"
        window.contentView = web
        window.setFrameAutosaveName("DesignStudioMain")
        if !window.setFrameUsingName("DesignStudioMain") { window.center() }
        window.makeKeyAndOrderFront(nil)
        NSApp.activate()
        buildMenu()

        // A hosted studio is the host's job to keep up; load it straight away.
        if remote != nil { web.load(URLRequest(url: home)); return }
        Task {
            if await !serverUp() { startServer() }
            for _ in 0..<120 {
                if await serverUp() { break }
                try? await Task.sleep(for: .milliseconds(500))
            }
            web.load(URLRequest(url: home))
        }
    }

    func serverUp() async -> Bool {
        var req = URLRequest(url: home)
        req.timeoutInterval = 1
        return (try? await URLSession.shared.data(for: req)) != nil
    }

    func startServer() {
        guard !repo.isEmpty else { return }
        let p = Process()
        p.executableURL = URL(fileURLWithPath: "/bin/zsh")
        p.arguments = ["-lc", "exec pnpm dev"]  // login shell: Dock-launched apps don't get your PATH
        p.currentDirectoryURL = URL(fileURLWithPath: repo)
        p.standardOutput = FileHandle.nullDevice
        p.standardError = FileHandle.nullDevice
        do { try p.run(); server = p } catch { NSLog("Design Studio: could not start dev server: \(error)") }
    }

    func applicationWillTerminate(_ note: Notification) { server?.terminate() }
    func applicationShouldTerminateAfterLastWindowClosed(_ app: NSApplication) -> Bool { true }

    // Links that leave the studio open in the default browser.
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping @MainActor (WKNavigationActionPolicy) -> Void) {
        if let url = action.request.url, url.host != home.host, action.navigationType == .linkActivated {
            NSWorkspace.shared.open(url)
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation nav: WKNavigation!, withError error: Error) {
        NSLog("Design Studio: could not load \(home): \(error.localizedDescription)")
    }
    func webView(_ webView: WKWebView, didFinish nav: WKNavigation!) {
        NSLog("Design Studio: loaded \(webView.url?.absoluteString ?? "?")")
    }

    func webView(_ webView: WKWebView, createWebViewWith config: WKWebViewConfiguration,
                 for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url { NSWorkspace.shared.open(url) }
        return nil
    }

    // Go menu: each item's representedObject is a studio path.
    @objc func go(_ sender: NSMenuItem) {
        guard let path = sender.representedObject as? String else { return }
        web.load(URLRequest(url: home.appending(path: path)))
    }

    // The page owns ⌘K; replay it so the menu item opens the same search.
    @objc func search() {
        web.evaluateJavaScript("""
            document.dispatchEvent(new KeyboardEvent('keydown', {key: 'k', metaKey: true, bubbles: true}))
            """)
    }

    @objc func reload() { web.reload() }
    @objc func goHome() { web.load(URLRequest(url: home)) }
    @objc func back() { web.goBack() }
    @objc func forward() { web.goForward() }

    func buildMenu() {
        let main = NSMenu()
        func menu(_ title: String, _ items: [NSMenuItem]) {
            let item = NSMenuItem()
            item.submenu = NSMenu(title: title)
            items.forEach { item.submenu!.addItem($0) }
            main.addItem(item)
        }
        func item(_ t: String, _ a: Selector, _ k: String, mine: Bool = false) -> NSMenuItem {
            let i = NSMenuItem(title: t, action: a, keyEquivalent: k)
            if mine { i.target = self }
            return i
        }
        menu("Design Studio", [item("Hide Design Studio", #selector(NSApplication.hide(_:)), "h"),
                               .separator(),
                               item("Quit Design Studio", #selector(NSApplication.terminate(_:)), "q")])
        menu("Edit", [item("Undo", Selector(("undo:")), "z"), item("Redo", Selector(("redo:")), "Z"), .separator(),
                      item("Cut", #selector(NSText.cut(_:)), "x"), item("Copy", #selector(NSText.copy(_:)), "c"),
                      item("Paste", #selector(NSText.paste(_:)), "v"),
                      item("Select All", #selector(NSText.selectAll(_:)), "a")])
        menu("View", [item("Reload", #selector(reload), "r", mine: true),
                      item("Home", #selector(goHome), "H", mine: true),
                      item("Back", #selector(back), "[", mine: true),
                      item("Forward", #selector(forward), "]", mine: true)])
        func place(_ t: String, _ path: String, _ k: String) -> NSMenuItem {
            let i = item(t, #selector(go(_:)), k, mine: true)
            i.representedObject = path
            return i
        }
        menu("Go", [item("Search the Studio", #selector(search), "k", mine: true), .separator(),
                    place("Home", "", "1"), place("Prototypes", "prototypes", "2"),
                    place("Systems", "systems", "3"), place("Documentation", "documentation", "4"),
                    place("Review", "review", "5"), .separator(),
                    place("Settings", "settings", ",")])
        menu("Window", [item("Minimize", #selector(NSWindow.miniaturize(_:)), "m"),
                        item("Close", #selector(NSWindow.performClose(_:)), "w")])
        NSApp.mainMenu = main
    }
}
