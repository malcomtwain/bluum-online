import React, { useState } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import List from '@mui/material/List';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import HomeIcon from '@mui/icons-material/Home';
import AddIcon from '@mui/icons-material/Add';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import ScheduleIcon from '@mui/icons-material/Schedule';
import CampaignIcon from '@mui/icons-material/Campaign';
import VideoCreator from './components/VideoCreator';

const drawerWidth = 240;

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

function App() {
  const [selectedMenu, setSelectedMenu] = useState('home');

  const menuItems = [
    { text: 'Home', icon: <HomeIcon />, id: 'home' },
    { text: 'Create', icon: <AddIcon />, id: 'create' },
    { text: 'Videos', icon: <VideoLibraryIcon />, id: 'videos' },
    { text: 'Schedule', icon: <ScheduleIcon />, id: 'schedule' },
    { text: 'Campaigns', icon: <CampaignIcon />, id: 'campaigns' },
  ];

  const renderContent = () => {
    switch (selectedMenu) {
      case 'create':
        return <VideoCreator />;
      case 'home':
        return (
          <Typography variant="h4" gutterBottom>
            Welcome to Bluum
          </Typography>
        );
      case 'videos':
        return (
          <Typography variant="h4" gutterBottom>
            Your Videos
          </Typography>
        );
      case 'schedule':
        return (
          <Typography variant="h4" gutterBottom>
            Schedule
          </Typography>
        );
      case 'campaigns':
        return (
          <Typography variant="h4" gutterBottom>
            Campaigns
          </Typography>
        );
      default:
        return null;
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex' }}>
        <Drawer
          variant="permanent"
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              boxSizing: 'border-box',
            },
          }}
        >
          <Toolbar>
            <Typography variant="h6" noWrap component="div">
              Bluum
            </Typography>
          </Toolbar>
          <Divider />
          <List>
            {menuItems.map((item) => (
              <ListItem
                button
                key={item.id}
                selected={selectedMenu === item.id}
                onClick={() => setSelectedMenu(item.id)}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.text} />
              </ListItem>
            ))}
          </List>
        </Drawer>
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            bgcolor: 'background.default',
            p: 3,
          }}
        >
          <Toolbar />
          {renderContent()}
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;
