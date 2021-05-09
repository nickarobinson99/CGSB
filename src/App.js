import logo from './logo.svg';
import './App.css';
import 'antd/dist/antd.css'
import Scoreboard from './components/Scoreboard'
import React from 'react';



export default class App extends React.Component {
  componentDidMount() {
    document.title = "Chatguessr Leaderboard"
  }
  render() {
    return (
      <React.Fragment>
        
        <Scoreboard/>
      </React.Fragment>
      
    );
  }

}


