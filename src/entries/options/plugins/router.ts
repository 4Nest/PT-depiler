import { createRouter, createWebHashHistory, type RouteRecordRaw } from "vue-router";

export const setBaseChildren: RouteRecordRaw[] = [
  {
    path: "",
    alias: "ui",
    name: "SetBaseUi",
    meta: { icon: "palette" },
    component: () => import("../views/Settings/SetBase/UiWindow.vue"),
  },
  {
    path: "search-entity",
    name: "SetBaseSearchEntity",
    meta: { icon: "search" },
    component: () => import("../views/Settings/SetBase/SearchEntityWindow.vue"),
  },
  {
    path: "download",
    name: "SetBaseDownload",
    meta: { icon: "download" },
    component: () => import("../views/Settings/SetBase/DownloadWindow.vue"),
  },
  {
    path: "user-info",
    name: "SetBaseUserInfo",
    meta: { icon: "user" },
    component: () => import("../views/Settings/SetBase/UserInfoWindow.vue"),
  },
  {
    path: "backup",
    name: "SetBaseBackup",
    meta: { icon: "key-round", usesGlobalSave: true },
    component: () => import("../views/Settings/SetBase/BackupWindow.vue"),
  },
] as const;

export const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "Overview",
    meta: { isMainMenu: true },
    children: [
      {
        path: "/my-data",
        name: "MyData",
        alias: "",
        meta: { icon: "layout-dashboard" },
        component: () => import("../views/Overview/MyData/Index.vue"),
      },
      {
        path: "/search-entity",
        name: "SearchEntity",
        meta: { icon: "search" },
        component: () => import("../views/Overview/SearchEntity/Index.vue"),
      },
    ],
  },
  {
    path: "/settings",
    name: "Settings",
    redirect: "/set-site",
    meta: { isMainMenu: true },
    children: [
      {
        path: "/set-site",
        name: "SetSite",
        meta: { icon: "globe" },
        component: () => import("../views/Settings/SetSite/Index.vue"),
      },
      {
        path: "/set-downloader",
        name: "SetDownloader",
        meta: { icon: "hard-drive-download" },
        component: () => import("../views/Settings/SetDownloader/Index.vue"),
      },
      {
        path: "/set-search-solution",
        name: "SetSearchSolution",
        meta: { icon: "layers" },
        component: () => import("../views/Settings/SetSearchSolution/Index.vue"),
      },
      {
        path: "/set-backup",
        name: "SetBackup",
        meta: { icon: "cloud-upload" },
        component: () => import("../views/Settings/SetBackup/Index.vue"),
      },
      {
        path: "/set-base",
        name: "SetBase",
        meta: { icon: "sliders-horizontal" },
        component: () => import("../views/Settings/SetBase/Index.vue"),
        children: setBaseChildren,
      },
    ],
  },
  {
    path: "/about",
    name: "About",
    meta: { isMainMenu: true, keepAlive: true },
    children: [
      {
        path: "/logger",
        name: "Logger",
        meta: { icon: "scroll-text" },
        component: () => import("../views/About/Logger.vue"),
      },
    ],
  },
  {
    path: "/devtools",
    name: "Devtools",
    meta: { isMainMenu: false },
    children: [
      {
        path: "/debugger",
        name: "Debugger",
        meta: { icon: "bug" },
        component: () => import("../views/Devtools/Debugger.vue"),
      },
    ],
  },
  {
    path: "/user-data-timeline",
    name: "UserDataTimeline",
    meta: { isMainMenu: false },
    component: () => import("../views/Overview/MyData/UserDataTimeline/Index.vue"),
  },
  {
    path: "/user-data-statistic",
    name: "UserDataStatistic",
    meta: { isMainMenu: false },
    component: () => import("../views/Overview/MyData/UserDataStatistic/Index.vue"),
  },
  { path: "/:pathMatch(.*)*", name: "NotFound", redirect: "/" },
];

if (localStorage.getItem("enable_devtools") !== null) {
  const devRouteIndex = routes.findIndex((x) => x.name == "Devtools");
  routes[devRouteIndex].meta!.isMainMenu = true;
} else {
  console.info('[PTD] Input `localStorage.setItem("enable_devtools", 1)` in console to enable devtools.');
}

export const routerInstance = createRouter({
  history: createWebHashHistory(),
  routes,
});
