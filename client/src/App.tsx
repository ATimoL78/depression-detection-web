import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { Loader2 } from "lucide-react";

// 立即加载关键页面
import Home from "./pages/Home";
import Login from "./pages/Login";

// 懒加载非关键页面
const Dashboard = lazy(() => import("./pages/Dashboard"));
const FaceDetection = lazy(() => import("./pages/FaceDetection"));
const DialogueAnalysis = lazy(() => import("./pages/DialogueAnalysis"));
const RealtimeDetection = lazy(() => import("./pages/RealtimeDetection"));
const Assessment = lazy(() => import("./pages/Assessment"));
const EmotionDiary = lazy(() => import("./pages/EmotionDiary"));
const TrendAnalysis = lazy(() => import("./pages/TrendAnalysis"));
const NotFound = lazy(() => import("@/pages/NotFound"));

// 加载占位组件
const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-accent/10 to-background">
    <div className="text-center">
      <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
      <p className="text-muted-foreground">加载中...</p>
    </div>
  </div>
);

function Router() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Switch>
        <Route path={"/"} component={Home} />
        <Route path={"/login"} component={Login} />
        <Route path={"/dashboard"} component={Dashboard} />
        <Route path={"/detection/face"} component={FaceDetection} />
        <Route path={"/detection/dialogue"} component={DialogueAnalysis} />
        <Route path={"/detection/realtime"} component={RealtimeDetection} />
        <Route path={"/assessment"} component={Assessment} />
        <Route path={"/emotion-diary"} component={EmotionDiary} />
        <Route path={"/trend-analysis"} component={TrendAnalysis} />
        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
