import React, { Suspense, lazy, useState } from 'react';
import {
    LayoutDashboard,
    FolderKanban,
    CheckSquare,
    FileText,
    FolderOpen,
    FlaskConical,
    MessageSquare,
    Settings,
    LogOut,
    Factory,
    ChevronLeft,
    ChevronRight,
    Upload,
    Users,
    Shield,
    FileBarChart,
    User as UserIcon,
    Bell,
    Search,
    ShieldAlert,
    History
} from 'lucide-react';
import { User, Page } from '../types';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip';
import { cn } from '../components/ui/utils';
import logo from '../assets/logo.png';
import { isSuperAdminRole } from '../features/dashboard/components/files/roleUtils';
import { canAccessPage } from '../utils/rbac';
import { getAccessiblePlantIds } from '../utils/projectAccess';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { markAllNotificationsRead, markNotificationRead } from '../features/notifications/notificationSlice';

const UserSwitcher = lazy(() => import('../components/UserSwitcher'));

interface DashboardLayoutProps {
    user: User;
    currentPage: Page;
    onNavigate: (page: Page) => void;
    onLogout: () => void;
    onUserChange?: (user: User) => void;
    children: React.ReactNode;
    title?: string;
}

interface MenuGroup {
    title: string;
    items: {
        id: Page;
        icon: React.ElementType;
        label: string;
    }[];
}

export default function DashboardLayout({ user, currentPage, onNavigate, onLogout, onUserChange, children, title }: DashboardLayoutProps) {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const plants = useAppSelector(state => state.organization.plants);
    const accessiblePlantIds = getAccessiblePlantIds(user, plants);

    const initialPlant = (() => {
        const stored = localStorage.getItem('selectedPlantId');
        if (stored) return stored;
        if (accessiblePlantIds.length > 0) return accessiblePlantIds[0];
        return plants[0]?.id;
    })();

    const [selectedPlant, setSelectedPlant] = useState<string | undefined>(initialPlant);

    const menuGroups: MenuGroup[] = [
        {
            title: 'Overview',
            items: [
                { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
                { id: 'calendar', icon: FileBarChart, label: 'Calendar' },
            ]
        },
        {
            title: 'Work Management',
            items: [
                { id: 'projects', icon: FolderKanban, label: 'Projects' },
                { id: 'tasks', icon: CheckSquare, label: 'Task Template' },
                { id: 'forms', icon: FileText, label: 'Forms' },
                { id: 'files', icon: FolderOpen, label: 'Files' },
            ]
        },
        {
            title: 'Quality & Compliance',
            items: [
                { id: 'calibration', icon: FlaskConical, label: 'Calibration' },
                // { id: 'logs', icon: FlaskConical, label: 'Logs' },
                //sa  // { id: 'audit-logs', icon: History, label: 'Audit Logs' },
            ]
        },
        {
            title: 'Collaboration',
            items: [
                { id: 'messages', icon: MessageSquare, label: 'Message Hub' },
            ]
        },
        {
            title: 'Administration',
            items: [
                { id: 'organization-management', icon: Factory, label: 'Plant & Dept' },
                { id: 'user-management', icon: Users, label: 'User Mgmt' },
                { id: 'rbac', icon: Shield, label: 'Access Matrix' },
                //sa // { id: 'security-compliance', icon: ShieldAlert, label: 'Security' },
                // { id: 'bulk-upload', icon: Upload, label: 'Bulk Import' },
                // { id: 'settings', icon: Settings, label: 'Settings' },
                // { id: 'BackendIntegrationSample', icon: FlaskConical, label: 'API Sample' },
            ]
        }
    ];

    const handleLogout = () => {
        onLogout();
    };

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    const dispatch = useAppDispatch();
    const notifications = useAppSelector(state => state.notifications.notifications ?? []);
    const unreadCount = notifications.filter((notification) => !notification.read).length;
    const recentNotifications = notifications.slice(0, 5);
    const permissions = useAppSelector(state => state.rbac.permissions);

    // Filter groups and items based on role
    const filteredGroups = menuGroups.map(group => ({
        ...group,
        items: group.items.filter(item => canAccessPage(user, item.id, permissions))
    })).filter(group => group.items.length > 0);

    return (
        <div className="flex h-screen overflow-hidden bg-background">
            {/* Sidebar */}
            <aside
                className={cn(
                    "flex flex-col transition-all duration-300 ease-in-out border-r shadow-xl z-20",
                    sidebarCollapsed ? "w-[80px]" : "w-[280px]"
                )}
                style={{
                    backgroundColor: '#393738',
                    borderColor: '#4a4a4a'
                }}
            >
                {/* Logo Section */}
                <div className="h-16 flex items-center px-6 border-b border-[#4a4a4a] relative">
                    <div className="flex items-center gap-3 w-full overflow-hidden">
                        <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 shadow-lg overflow-hidden"
                            style={{ backgroundColor: '#ffffff' }}
                        >
                            <img src={logo} alt="DT-Fusion360 Logo" className="w-8 h-8 object-contain" />
                        </div>

                        <div className={cn(
                            "flex flex-col transition-opacity duration-300 min-w-[150px]",
                            sidebarCollapsed ? "opacity-0 invisible absolute" : "opacity-100 visible"
                        )}>
                            <h2 className="text-white font-bold text-lg leading-none tracking-tight">DT-Fusion360</h2>
                            <span className="text-[#a0a0a0] text-xs">Enterprise Edition</span>
                        </div>
                    </div>
                </div>

                {/* Navigation Items */}
                <nav className="flex-1 py-6 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
                    <div className="space-y-6 px-3">
                        {filteredGroups.map((group, groupIndex) => (
                            <div key={group.title} className="space-y-1">
                                {/* Group Title */}
                                {!sidebarCollapsed && (
                                    <h3 className="px-4 text-[11px] font-bold text-[#888888] uppercase tracking-wider mb-2">
                                        {group.title}
                                    </h3>
                                )}

                                {/* Collapsed Divider */}
                                {sidebarCollapsed && groupIndex > 0 && (
                                    <div className="my-4 mx-2 border-t border-[#4a4a4a]" />
                                )}

                                {/* Items */}
                                {group.items.map((item) => {
                                    const Icon = item.icon;
                                    const isActive = currentPage === item.id;

                                    return (
                                        <div key={item.id}>
                                            {sidebarCollapsed ? (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <button
                                                            onClick={() => onNavigate(item.id as Page)}
                                                            className={cn(
                                                                "w-full flex items-center justify-center p-3 rounded-xl transition-all duration-200 group relative",
                                                                isActive ? "bg-[#ed1c24] text-white shadow-md" : "text-[#e0e0e0] hover:bg-[#4a4a4a] hover:text-white"
                                                            )}
                                                        >
                                                            <Icon className="w-5 h-5" />
                                                            {isActive && (
                                                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-white/20 rounded-r-full" />
                                                            )}
                                                        </button>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="right" className="bg-[#1a1a1a] text-white border-[#4a4a4a]">
                                                        {item.label}
                                                    </TooltipContent>
                                                </Tooltip>
                                            ) : (
                                                <button
                                                    onClick={() => onNavigate(item.id as Page)}
                                                    className={cn(
                                                        "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 group relative overflow-hidden",
                                                        isActive ? "bg-[#ed1c24] text-white shadow-md font-medium" : "text-[#e0e0e0] hover:bg-[#4a4a4a] hover:text-white"
                                                    )}
                                                >
                                                    <Icon className={cn(
                                                        "w-5 h-5 flex-shrink-0 transition-transform duration-300",
                                                        isActive ? "scale-110" : "group-hover:scale-110"
                                                    )} />
                                                    <span className="truncate">{item.label}</span>

                                                    {/* Active Indicator Strip */}
                                                    {isActive && (
                                                        <div className="absolute right-0 top-0 bottom-0 w-1 bg-white/20" />
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </nav>

                {/* Footer Actions */}
                <div className="p-4 border-t border-[#4a4a4a] space-y-2 bg-[#323031]">
                    {sidebarCollapsed ? (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={handleLogout}
                                    className="w-full flex items-center justify-center p-3 rounded-xl text-[#e0e0e0] hover:bg-[#ed1c24] hover:text-white transition-colors"
                                >
                                    <LogOut className="w-5 h-5" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="right">Logout</TooltipContent>
                        </Tooltip>
                    ) : (
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-[#e0e0e0] hover:bg-[#ed1c24] hover:text-white transition-colors group"
                        >
                            <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                            <span className="font-medium">Logout</span>
                        </button>
                    )}

                    <button
                        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                        className="w-full flex items-center justify-center p-2 rounded-xl text-[#888888] hover:text-white hover:bg-[#4a4a4a] transition-all"
                    >
                        {sidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col overflow-hidden bg-[#f4f4f5]">
                {/* Modern Header */}
                <header className="h-16 bg-white border-b shadow-sm flex items-center justify-between px-6 z-10">
                    <div className="flex items-center gap-6 flex-1">
                        {/* Context Title or Breadcrumb could go here */}
                        {title && (
                            <div className="flex flex-col">
                                <h1 className="text-lg font-bold text-[#393738] tracking-tight">{title}</h1>
                                {/* <span className="text-xs text-muted-foreground">Overview & Stats</span> */}
                            </div>
                        )}

                        {/* Global Search Bar */}
                        {/* <div className="relative w-full max-w-lg hidden lg:block group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-[#ed1c24] transition-colors" />
                            <Input
                                type="search"
                                placeholder="Search projects, tasks, files..."
                                className="w-full bg-slate-50 border-slate-200 pl-10 focus-visible:ring-[#ed1c24] transition-all rounded-full"
                            />
                        </div> */}
                    </div>

                    <div className="flex items-center gap-4">
                        {/* User Switcher - SuperAdmin Only */}
                        {onUserChange && isSuperAdminRole(user.role) && (
                            <Suspense fallback={null}>
                                <UserSwitcher currentUser={user} onUserChange={onUserChange} />
                            </Suspense>
                        )}

                        {/* Plant Switcher: show when user has access to multiple plants */}
                        {accessiblePlantIds.length > 1 && (
                            <Select
                                value={selectedPlant}
                                onValueChange={(val) => {
                                    setSelectedPlant(val);
                                    try {
                                        localStorage.setItem('selectedPlantId', val as string);
                                    } catch (e) {}
                                    // notify other parts of the app
                                    try { window.dispatchEvent(new CustomEvent('plantChange', { detail: { plantId: val } })); } catch (e) {}
                                }}
                            >
                                <SelectTrigger className="w-[200px] bg-slate-50 border-slate-200 rounded-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {accessiblePlantIds.map((pid) => {
                                        const p = plants.find((x) => x.id === pid);
                                        return (
                                            <SelectItem key={pid} value={pid}>
                                                {p ? p.name : pid}
                                            </SelectItem>
                                        );
                                    })}
                                </SelectContent>
                            </Select>
                        )}

                        {/* Notification Bell */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="relative rounded-full hover:bg-slate-100" aria-label="Notifications">
                                    <Bell className="h-5 w-5 text-slate-600" />
                                    {unreadCount > 0 && (
                                        <span className="absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ed1c24] px-1 text-[10px] font-semibold text-white">
                                            {unreadCount > 9 ? '9+' : unreadCount}
                                        </span>
                                    )}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-[320px] mt-2">
                                <div className="px-3 py-2 flex items-center justify-between gap-3">
                                    <span className="text-sm font-semibold">Notifications</span>
                                    {notifications.length > 0 && (
                                        <button
                                            type="button"
                                            className="text-xs text-slate-500 hover:text-slate-900"
                                            onClick={() => dispatch(markAllNotificationsRead(user.id))}
                                        >
                                            Mark all read
                                        </button>
                                    )}
                                </div>
                                <DropdownMenuSeparator />
                                {recentNotifications.length === 0 ? (
                                    <div className="p-4 text-sm text-muted-foreground">No recent notifications.</div>
                                ) : (
                                    recentNotifications.map((notification) => (
                                        <div key={notification.id} className="p-3 hover:bg-slate-50 rounded-lg cursor-pointer" onClick={() => dispatch(markNotificationRead(notification.id))}>
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-sm font-medium text-slate-900">{notification.title}</span>
                                                {!notification.read && <span className="text-[10px] uppercase text-[#ed1c24] font-bold">NEW</span>}
                                            </div>
                                            <p className="text-xs text-slate-500 mt-1 leading-snug">{notification.message}</p>
                                            <p className="text-[10px] text-muted-foreground mt-2">{new Date(notification.createdAt).toLocaleString()}</p>
                                        </div>
                                    ))
                                )}
                                {notifications.length > 5 && (
                                    <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => onNavigate('messages')}>
                                            View all notifications
                                        </DropdownMenuItem>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* User Profile Menu */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="flex items-center gap-3 pl-2 pr-4 py-1 h-auto rounded-full hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-all">
                                    <Avatar className="w-9 h-9 border-2 border-white shadow-sm">
                                        <AvatarFallback className="bg-[#ed1c24] text-white font-bold">
                                            {getInitials(user.name)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="text-left hidden md:block">
                                        <p className="text-sm font-semibold text-slate-800 leading-none">{user.name}</p>
                                        <p className="text-sm text-slate-500 font-medium mt-1 leading-none uppercase tracking-wide">{user.role}</p>
                                    </div>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56 mt-2">
                                <DropdownMenuLabel>
                                    <div className="flex flex-col space-y-1">
                                        <p className="font-medium">{user.name}</p>
                                        <p className="text-xs text-muted-foreground">{user.email}</p>
                                    </div>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="cursor-pointer" onClick={() => onNavigate('settings')}>
                                    <UserIcon className="w-4 h-4 mr-2" />
                                    My Profile
                                </DropdownMenuItem>
                                <DropdownMenuItem className="cursor-pointer" onClick={() => onNavigate('settings')}>
                                    <Settings className="w-4 h-4 mr-2" />
                                    Settings
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="cursor-pointer text-red-600 focus:text-red-600" onClick={handleLogout}>
                                    <LogOut className="w-4 h-4 mr-2" />
                                    Logout
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </header>

                {/* Dynamic Page Content */}
                <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8 scroll-smooth">
                    <div className="mx-auto max-w-[1920px] animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
