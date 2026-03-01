/**
 * Main navigation – bottom tabs for authenticated users, auth stack for unauthenticated.
 * Mirrors the web app's sidebar navigation structure.
 */
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import useAuth from '../hooks/useAuth';
import { LoadingScreen } from '../components/UI';
import { colors, fontSize } from '../theme';

// Screens
import AuthScreen from '../screens/Auth/LoginScreen';
import DashboardScreen from '../screens/Dashboard/DashboardScreen';
import ProjectsScreen from '../screens/Projects/ProjectsScreen';
import ProjectDetailsScreen from '../screens/Projects/ProjectDetailsScreen';
import CommunityScreen from '../screens/Community/CommunityScreen';
import MeetingsScreen from '../screens/Meetings/MeetingsScreen';
import EventsScreen from '../screens/Events/EventsScreen';
import EventDetailsScreen from '../screens/Events/EventDetailsScreen';
import ProfileScreen from '../screens/Profile/ProfileScreen';
import MoreScreen from '../screens/More/MoreScreen';
import MembersScreen from '../screens/More/MembersScreen';
import InventoryScreen from '../screens/More/InventoryScreen';
import LearningHubScreen from '../screens/More/LearningHubScreen';
import ProgramsHubScreen from '../screens/More/ProgramsHubScreen';
import HierarchyScreen from '../screens/More/HierarchyScreen';
import NotificationsScreen from '../screens/More/NotificationsScreen';
import AdminPanelScreen from '../screens/More/AdminPanelScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const screenOptions = {
  headerStyle: { backgroundColor: colors.surface1 },
  headerTintColor: colors.textPrimary,
  headerTitleStyle: { fontWeight: '600', fontSize: fontSize.md },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: colors.surface0 },
};

function DashboardStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="DashboardHome" component={DashboardScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ProjectDetails" component={ProjectDetailsScreen} options={{ title: 'Project' }} />
      <Stack.Screen name="EventDetails" component={EventDetailsScreen} options={{ title: 'Event' }} />
    </Stack.Navigator>
  );
}

function ProjectsStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="ProjectsList" component={ProjectsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ProjectDetails" component={ProjectDetailsScreen} options={{ title: 'Project' }} />
    </Stack.Navigator>
  );
}

function EventsStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="EventsList" component={EventsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="EventDetails" component={EventDetailsScreen} options={{ title: 'Event' }} />
    </Stack.Navigator>
  );
}

function MoreStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="MoreHome" component={MoreScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Members" component={MembersScreen} options={{ title: 'Members' }} />
      <Stack.Screen name="Inventory" component={InventoryScreen} options={{ title: 'Inventory' }} />
      <Stack.Screen name="LearningHub" component={LearningHubScreen} options={{ title: 'Learning Hub' }} />
      <Stack.Screen name="ProgramsHub" component={ProgramsHubScreen} options={{ title: 'Programs Hub' }} />
      <Stack.Screen name="Hierarchy" component={HierarchyScreen} options={{ title: 'Tasks' }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
      <Stack.Screen name="AdminPanel" component={AdminPanelScreen} options={{ title: 'Admin' }} />
    </Stack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface1,
          borderTopColor: colors.borderSubtle,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 4,
        },
        tabBarActiveTintColor: colors.accentBlue,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
        tabBarIcon: ({ focused, color, size }) => {
          const icons = {
            Dashboard: focused ? 'grid' : 'grid-outline',
            Projects: focused ? 'folder-open' : 'folder-open-outline',
            Community: focused ? 'chatbubbles' : 'chatbubbles-outline',
            Events: focused ? 'calendar' : 'calendar-outline',
            Profile: focused ? 'person' : 'person-outline',
            More: focused ? 'apps' : 'apps-outline',
          };
          return <Ionicons name={icons[route.name] || 'ellipse-outline'} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardStack} />
      <Tab.Screen name="Projects" component={ProjectsStack} />
      <Tab.Screen name="Community" component={CommunityScreen} />
      <Tab.Screen name="Events" component={EventsStack} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
      <Tab.Screen name="More" component={MoreStack} />
    </Tab.Navigator>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Auth" component={AuthScreen} />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const { token, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  return (
    <NavigationContainer>
      {token ? (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Main" component={MainTabs} />
          {/* Global stack screens accessible from anywhere */}
          <Stack.Screen name="Meetings" component={MeetingsScreen} options={{ ...screenOptions, title: 'Meetings', headerShown: true }} />
        </Stack.Navigator>
      ) : (
        <AuthStack />
      )}
    </NavigationContainer>
  );
}
