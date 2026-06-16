import React, { useEffect, useMemo } from 'react';
import { FolderKanban, CheckCircle2, AlertCircle, FileText, TrendingUp, Clock } from 'lucide-react';
import { User, Page } from '../App';
import Layout from './Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchDashboardData } from '../features/dashboard/dashboardSlice';

interface DashboardProps {
  user: User;
  onNavigate: (page: Page) => void;
  onLogout: () => void;
}

export default function Dashboard({ user, onNavigate, onLogout }: DashboardProps) {
  const dispatch = useAppDispatch();
  const { stats, tasks, projects, calibrationItems, loading, error } = useAppSelector(
    (state) => state.dashboard
  );

  // Fetch dashboard data on component mount
  useEffect(() => {
    dispatch(fetchDashboardData());
  }, [dispatch]);

  const greeting = `Welcome back, ${user.name.split(' ')[0]}`;

  // Build KPI data from real statistics
  const kpiData = useMemo(() => {
    return [
      {
        title: 'Active Projects',
        value: stats?.activeProjects || 0,
        icon: FolderKanban,
        change: 'In progress',
        color: '#ed1c24'
      },
      {
        title: 'Completed Tasks',
        value: stats?.completedTasks || 0,
        icon: CheckCircle2,
        change: 'This period',
        color: '#2ecc71'
      },
      {
        title: 'Overdue Tasks',
        value: stats?.overdueItems || 0,
        icon: AlertCircle,
        change: 'Require attention',
        color: '#f5a623'
      },
      {
        title: 'Pending Items',
        value: stats?.pendingForms || 0,
        icon: FileText,
        change: 'Need action',
        color: '#3498db'
      }
    ];
  }, [stats]);

  // Transform phase data for chart
  const apqpPhaseData = useMemo(() => {
    if (!stats?.projectsByPhase) return [];
    return Object.entries(stats.projectsByPhase).map(([phase, count]) => ({
      phase: phase.substring(0, 8), // Abbreviate long phase names
      projects: count,
      name: phase
    }));
  }, [stats]);

  // Get top 5 tasks
  const myTasks = useMemo(() => {
    return (tasks || []).slice(0, 5);
  }, [tasks]);

  // Get top 3 calibration items due soon
  const calibrationDue = useMemo(() => {
    if (!calibrationItems) return [];
    return calibrationItems
      .filter(item => item.status === 'Due Soon' || item.status === 'Overdue')
      .slice(0, 3);
  }, [calibrationItems]);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return '#2ecc71';
      case 'in progress':
      case 'pending':
        return '#f5a623';
      case 'overdue':
        return '#ed1c24';
      default:
        return '#6b6b6b';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high':
        return '#ed1c24';
      case 'medium':
        return '#f5a623';
      case 'low':
        return '#3498db';
      default:
        return '#6b6b6b';
    }
  };

  return (
    <Layout user={user} currentPage="dashboard" onNavigate={onNavigate} onLogout={onLogout} title="Dashboard">
      <div className="space-y-6">
        {/* Greeting */}
        <div>
          <h2 className="mb-1">{greeting}</h2>
          <p className="text-muted-foreground">Here's what's happening with your projects today.</p>
        </div>

        {/* Error message if data fetch failed */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <p className="text-red-800 text-sm">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Loading skeleton or KPI Cards */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="animate-pulse" style={{ borderRadius: '12px' }}>
                <CardHeader className="pb-2">
                  <div className="h-4 bg-slate-200 rounded w-24"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-8 bg-slate-200 rounded w-16 mb-2"></div>
                  <div className="h-3 bg-slate-200 rounded w-32"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {kpiData.map((kpi, index) => {
              const Icon = kpi.icon;
              return (
                <Card key={index} className="hover:shadow-lg transition-shadow" style={{ borderRadius: '12px' }}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm text-muted-foreground">{kpi.title}</CardTitle>
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${kpi.color}15` }}
                    >
                      <Icon className="w-5 h-5" style={{ color: kpi.color }} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl mb-1">{kpi.value}</div>
                    <p className="text-xs text-muted-foreground">{kpi.change}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Charts and Tables Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* APQP Phase Chart */}
          <Card style={{ borderRadius: '12px' }}>
            <CardHeader>
              <CardTitle>Projects by APQP Phase</CardTitle>
              <CardDescription>Distribution across development phases</CardDescription>
            </CardHeader>
            <CardContent>
              {apqpPhaseData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={apqpPhaseData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis dataKey="phase" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e0e0e0' }}
                      labelFormatter={(label, payload) => {
                        const item = payload[0]?.payload;
                        return item ? `${item.name}` : label;
                      }}
                    />
                    <Bar dataKey="projects" fill="#ed1c24" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-80 flex items-center justify-center text-muted-foreground">
                  No project phase data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* My Tasks */}
          <Card style={{ borderRadius: '12px' }}>
            <CardHeader>
              <CardTitle>My Tasks</CardTitle>
              <CardDescription>Recent tasks assigned to you</CardDescription>
            </CardHeader>
            <CardContent>
              {myTasks.length > 0 ? (
                <div className="space-y-3">
                  {myTasks.map((task) => (
                    <div key={task.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm">{task.task}</p>
                          <Badge 
                            variant="outline" 
                            className="text-xs"
                            style={{ 
                              borderColor: getPriorityColor(task.priority),
                              color: getPriorityColor(task.priority)
                            }}
                          >
                            {task.priority}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {task.phase && <span>{task.phase}</span>}
                          {task.phase && <span>•</span>}
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(task.dueDate).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <Badge 
                        className="ml-3"
                        style={{ 
                          backgroundColor: getStatusColor(task.status),
                          color: '#ffffff'
                        }}
                      >
                        {task.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No tasks assigned</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Additional Widgets Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Project Overview */}
          <Card style={{ borderRadius: '12px' }}>
            <CardHeader>
              <CardTitle>Project Overview</CardTitle>
              <CardDescription>Active and completed projects</CardDescription>
            </CardHeader>
            <CardContent>
              {projects && projects.length > 0 ? (
                <div className="space-y-4">
                  {projects.slice(0, 3).map((project) => (
                    <div key={project.id} className="p-3 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-sm font-medium">{project.name}</p>
                          <p className="text-xs text-muted-foreground">{project.phase || 'No phase'}</p>
                        </div>
                        <Badge style={{ 
                          backgroundColor: project.status === 'active' || project.status === 'In Progress' ? '#2ecc71' : '#f5a623',
                          color: '#ffffff'
                        }}>
                          {project.status}
                        </Badge>
                      </div>
                      {project.progress !== undefined && (
                        <Progress value={project.progress} className="h-1" />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No projects available</p>
              )}
            </CardContent>
          </Card>

          {/* Calibration Due (QA Only) */}
          {user.role === 'QA' ? (
            <Card style={{ borderRadius: '12px' }}>
              <CardHeader>
                <CardTitle>Calibration Due</CardTitle>
                <CardDescription>Instruments requiring calibration</CardDescription>
              </CardHeader>
              <CardContent>
                {calibrationDue.length > 0 ? (
                  <div className="space-y-4">
                    {calibrationDue.map((item) => (
                      <div key={item.id} className="p-3 rounded-lg bg-muted/50">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="text-sm mb-1">{item.name}</p>
                            <p className="text-xs text-muted-foreground">{item.id}</p>
                          </div>
                          <Badge 
                            variant="outline"
                            style={{ 
                              borderColor: item.status === 'Overdue' ? '#ed1c24' : '#f5a623',
                              color: item.status === 'Overdue' ? '#ed1c24' : '#f5a623'
                            }}
                          >
                            {item.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">Due: {new Date(item.dueDate).toLocaleDateString()}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No calibration items due</p>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card style={{ borderRadius: '12px' }}>
              <CardHeader>
                <CardTitle>Message Hub Alerts</CardTitle>
                <CardDescription>Unread messages and mentions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                           style={{ backgroundColor: '#ed1c24' }}>
                        <span className="text-white text-xs">{user.name.substring(0, 2).toUpperCase()}</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm mb-1">You have <strong>pending approvals</strong> in your queue</p>
                        <p className="text-xs text-muted-foreground">Review action items above</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </Layout>
  );
}
