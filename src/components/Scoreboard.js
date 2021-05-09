import {Table, Input, Button, Layout, Typography, Popover, Row, Col, Menu, Dropdown, Space, Popconfirm, notification, message} from 'antd'
import Highlighter from 'react-highlight-words';
import { DownOutlined, SearchOutlined } from '@ant-design/icons';
import React from 'react';
const {Search} = Input;
const {Title} = Typography;
const {Header, Content} = Layout;
const {ipcRenderer} = window.require('electron');
const col_style = {
  padding: '8px 0'
};
const send_geolink_message = (msg) => {
  message.success(`${msg.name} has sucessfully linked their geoprofile`)
}
const send_databaseupdated_message = (msg) => {
  message.success(`Database has been successfully updated with game ${msg.msg}`, 10)
}
export default class Scoreboard extends React.Component {
    constructor(props) {
      super(props)
      this._load = this._load.bind(this);
      this._loadName = this._loadName.bind(this);
      this._sendGimme = this._sendGimme.bind(this);
      this.spawnPopover = this.spawnPopover.bind(this);
      this._updateWindowDimensions = this._updateWindowDimensions.bind(this);
      this.handleDelete = this.handleDelete.bind(this);
      this._setTournament = this._setTournament.bind(this);
      this._loadTournaments = this._loadTournaments.bind(this);
      this.sendTournament = this.sendTournament.bind(this);
      this._sendGeoProfileMessage = this._sendGeoProfileMessage.bind(this);
      this._sendDataUpdatedMessage = this._sendDataUpdatedMessage.bind(this);
      this.one_to_one_scoring = {
        title: "1 win = 1 point",
        columns: [
        {
          title: 'Name',
          dataIndex: 'username',
          key: 'username',
          ...this.getColumnSearchProps('username')
        },
        {
          title: 'Wins',
          dataIndex: 'wins',
          key: 'wins',
          defaultSortOrder: 'descent',
          sorter: (a, b) => a.wins - b.wins,
        },
        {
          title: 'Games Played',
          dataIndex: 'games_played',
          key: 'games_played',
        }
      ]
      };
      this.chicago_scoring = {
        title: "Chicago Geographer Style",
        columns: [
        {
          title: 'Name',
          dataIndex: 'username',
          key: 'username',
          ...this.getColumnSearchProps('username')
        },
        {
          title: 'Avg. Dist. From Mean',
          dataIndex: 'avg_dist_from_mean',
          key: 'avg_dist_from_mean',
          defaultSortOrder: 'descent',
          render: (value, row, index) => {
            return value.toFixed(2);
          },
          sorter: (a,b) => a.avg_dist_from_mean - b.avg_dist_from_mean,
        },
        {
          title: 'Times Played',
          dataIndex: 'games_played',
          key: 'games_played',
        },
        {
          title: 'Games Won',
          dataIndex: 'wins',
          key: 'wins',
        },
      ]
      };
      this.mario_kart_8 = {
        title: "Mariokart 8",
        columns: [
        {
          title: "Name",
          dataIndex: "username",
          key: "username",
          ...this.getColumnSearchProps('username')
        },
        {
          title: "Points",
          dataIndex: "points",
          key: "points",
          defaultSortOrder: 'descent',
          sorter: (a,b) => a.points - b.points,
        },
        {
          title: "Games Won",
          dataIndex: "wins",
          key: "wins",
          sorter: (a,b) => a.wins - b.wins,
        },
        {
          title: "Times Played",
          dataIndex: "games_played",
          key: "games_played",
        },
      ]}
      this.umo_scoring = {
        title: "Umo",
        columns: [
          {
            title: "Name",
            dataIndex: "username",
            key: "username",
            ...this.getColumnSearchProps('username')
          },
          {
            title: "Points",
            dataIndex: "umo_score",
            key: "umo_score",
            defaultSortOrder: 'descent',
            sorter: (a,b) => a.umo_score - b.umo_score,
          },
          {
            title: "Games Won",
            dataIndex: "wins",
            key: "wins",
            sorter: (a,b) => a.wins - b.wins,
          },
          {
            title: "Times Played",
            dataIndex: "games_played",
            key: "games_played",
          }
        ]
      }
        this.state = {
            searchText: '',
            searchedColumn: '',
            data: null,
            chName: null,
            popoverContent: null,
            visible: false,
            current_scoring_system: this.chicago_scoring,
            width: 0, height: 0,
            tournaments: [],
            currentTournament:null
        }

        this.pdataColumns = [
          {
            title:'Map',
            dataIndex: 'map',
            key: 'map',
          },
          {
            title:'Score',
            dataIndex: 'score',
            key: 'score',
          },
          {
            title: 'Mean Score',
            dataIndex: 'scoreInfo',
            key: 'scoreInfo',
            render: (value, row, index) => {
              return value.avgScore.toFixed(2);
            },
          },
          {            
            title: 'Points From Mean',
            dataIndex: 'dist_from_mean',
            key: 'dist_from_mean',
            render: (value, row, index) => {
              return value.toFixed(2);
            },
          },
          {
            title: 'Placement',
            dataIndex: 'placement',
            key: 'placement',
          },
          {
            title: 'operation',
            dataIndex: 'operation',
            render: (_, record) =>
              this.state.popoverContent ? (
                <Popconfirm title="Are you sure you want to delete this record?" onConfirm={() => this.handleDelete(record)}>
                  <a>Delete</a>
                </Popconfirm>
              ) : null,
          }
        ]
        
    }
    componentDidMount() {
        this._updateWindowDimensions();
        ipcRenderer.on("dataDone", this._sendGimme);
        ipcRenderer.on("tables", this._load);
        ipcRenderer.on("currentTournament", this._setTournament);
        ipcRenderer.on("channelName", this._loadName);
        ipcRenderer.on("tournaments", this._loadTournaments);
        ipcRenderer.on("geoprofile", this._sendGeoProfileMessage);
        ipcRenderer.on("dataUpdated", this._sendDataUpdatedMessage);

        window.addEventListener('resize', this._updateWindowDimensions);
    }
    componentWillUnmount() {
      window.removeEventListener("resize", this._updateWindowDimensions.bind(this));
    }
    _updateWindowDimensions() {
      this.setState({width: window.innerWidth, height: window.innerHeight-64});
    }
    _loadTournaments(event, message) {
      this.setState({tournaments: message})
    }
    _setTournament(event, message) {
      this.setState({currentTournament: message});
      this.forceUpdate();
    }
    _sendGeoProfileMessage(event, message) {
      send_geolink_message(message)
    }
    _sendDataUpdatedMessage(event, message) {
      send_databaseupdated_message(message)
    }
    _load(event, message) {
      this.setState({data: message});
    }  
    _sendGimme(event, message) {
      ipcRenderer.send('giveme', 'gimmi');
    }
    _loadName(event, message) {
      this.setState({chName: message});
    }
    handleDelete(rec) {
      this.hide()
      ipcRenderer.send('delete-pgame', rec)
    }
    sendTournament(name) {
      ipcRenderer.send('sendTournament', name);
    }
    spawnPopover(content) {
      this.setState({
        visible: true,
        popoverContent: content,
      })
      
    }
    hide = () => {
      this.setState({
        visible: false,
      });
    };
    handleVisibleChange = (visible) => {
      this.setState({ visible });
    }
    getColumnSearchProps = dataIndex => ({
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }) => (
        <div style={{ padding: 8 }}>
          <Input
            ref={node => {
              this.searchInput = node;
            }}
            placeholder={`Search ${dataIndex}`}
            value={selectedKeys[0]}
            onChange={e => setSelectedKeys(e.target.value ? [e.target.value] : [])}
            onPressEnter={() => this.handleSearch(selectedKeys, confirm, dataIndex)}
            style={{ width: 188, marginBottom: 8, display: 'block' }}
          />
          <Space>
            <Button
              type="primary"
              onClick={() => this.handleSearch(selectedKeys, confirm, dataIndex)}
              icon={<SearchOutlined />}
              size="small"
              style={{ width: 90 }}
            >
              Search
            </Button>
            <Button onClick={() => this.handleReset(clearFilters)} size="small" style={{ width: 90 }}>
              Reset
            </Button>
            <Button
              type="link"
              size="small"
              onClick={() => {
                confirm({ closeDropdown: false });
                this.setState({
                  searchText: selectedKeys[0],
                  searchedColumn: dataIndex,
                });
              }}
            >
              Filter
            </Button>
          </Space>
        </div>
      ),
      filterIcon: filtered => <SearchOutlined style={{ color: filtered ? '#1890ff' : undefined }} />,
      onFilter: (value, record) =>
        record[dataIndex]
          ? record[dataIndex].toString().toLowerCase().includes(value.toLowerCase())
          : '',
      onFilterDropdownVisibleChange: visible => {
        if (visible) {
          setTimeout(() => this.searchInput.select(), 100);
        }
      },
      render: text =>
        this.state.searchedColumn === dataIndex ? (
          <Highlighter
            highlightStyle={{ backgroundColor: '#ffc069', padding: 0 }}
            searchWords={[this.state.searchText]}
            autoEscape
            textToHighlight={text ? text.toString() : ''}
          />
        ) : (
          text
        ),
    });
  
    handleSearch = (selectedKeys, confirm, dataIndex) => {
      confirm();
      this.setState({
        searchText: selectedKeys[0],
        searchedColumn: dataIndex,
      });
    };
  
    handleReset = clearFilters => {
      clearFilters();
      this.setState({ searchText: '' });
    };
    render() {
      const menu_overlay = (
        <Menu
        ghost
        mode="inline">
          
          <Menu.Item>
            <a target="_blank" rel="noopener noreferrer" onClick={() => {
              this.setState({current_scoring_system: this.chicago_scoring});
            }}>{this.chicago_scoring.title} </a>
          </Menu.Item>
            <Menu.Item>
              <a target="_blank" rel="noopener noreferrer" onClick={() => {
                this.setState({current_scoring_system: this.one_to_one_scoring});
              }}>
                {this.one_to_one_scoring.title}
              </a>
            </Menu.Item>
            <Menu.Item>
              <a target="_blank" rel="noopener noreferrer" onClick={() => {
                this.setState({current_scoring_system: this.mario_kart_8});
              }}>
                {this.mario_kart_8.title}
              </a>
            </Menu.Item>
            <Menu.Item>
              <a target="_blank" rel="noopener noreferrer" onClick={() => {
                this.setState({current_scoring_system: this.umo_scoring});
              }}>
                {this.umo_scoring.title}
              </a>
            </Menu.Item>
            
        </Menu>
    )

        return(        
        <Layout style={{backgroundColor:"#575a61"}}>
          <Header>
            <Row gutter={16}>
              <Col className="gutter-row" span={16}>
                <div style={col_style}>
                  <Title style={{marginTop: "8px", color: "#ededed"}} level={2}>{this.state.chName ? this.state.chName + "'s Leaderboard" : 'Loading channel name...'}</Title>
                </div>
              </Col>
              <Col className="gutter-row" span={8}>
                <div style={col_style}>
                  <Dropdown overlay = {menu_overlay}>
                    <Button ghost className="antd-dropdown-link" onClick={e => e.preventDefault()}>
                      {this.state.current_scoring_system.title} <DownOutlined/>
                    </Button>
                  </Dropdown>
                </div>
              </Col>
            </Row>
          </Header>

          <Content style={{backgroundColor: "#575a61", minHeight: this.state.height}}>
            <Row justify="center">
              <Col style={{}} span={16}>
              {this.state.popoverContent && this.state.visible ?          
                <Popover
                  placement="rightBottom"
                  trigger="click"
                  visible={this.state.visible}  
                  content={
                    <React.Fragment>
                      <Row>
                        <Col span={16}>
                          <Title level={4}>{this.state.popoverContent.username}</Title>
                        </Col>
                        <Col span={8}>
                          <Button onClick={this.hide} ghost type={"danger"}>Hide Player Data</Button>
                        </Col>
                      </Row>
                      <Table dataSource={this.state.popoverContent.games} columns={this.pdataColumns}></Table>
                    </React.Fragment>}>
                </Popover>: null }
                <Table
                pagination={{showSizeChanger: false, defaultPageSize: 10}} 
                style={{marginTop: 15}}
                  onRow={(record, rowIndex) => {
                    return {
                      onClick: event => {
                        this.setState({popoverContent: record})
                        this.spawnPopover(record)
                      }, // click row
                    };
                  }} 
                  dataSource={this.state.data} 
                  columns={this.state.current_scoring_system.columns}/>
              </Col>
          </Row>
          <Row justify="center">
          <Col span={4} style={{textAlign:'left', marginTop:10}}>              
              <Dropdown overlay = {   
              <Menu>
                {this.state.tournaments.map((tournament, key) => {
                  
                  return <Menu.Item key={key}>
                    <a onClick={() => {
                      this.setState({currentTournament: tournament.name});
                      this.sendTournament(tournament.name);
                    }}>{tournament.name.replace('.db', '')}</a>
                  </Menu.Item>
                })}
              </Menu>}>
                    <Button ghost className="antd-dropdown-link" onClick={e => e}>
                      {this.state.currentTournament ? this.state.currentTournament.replace('.db', ''): this.state.currentTournament} <DownOutlined/>
                    </Button>
              </Dropdown>
              </Col>
            <Col span={10} style={{textAlign: 'center', marginTop: 10}}>
              <Search 
              enterButton="Create"
              placeholder="Start a new tournament..."
              onSearch={(e) => {
                let to_send = e + '.db';
                if (to_send != '.db') {
                  this.sendTournament(to_send)
                  this.setState({currentTournament: to_send})
                }
              }}/>
                
              
            </Col>
            <Col span={2} style={{textAlign:'right', marginBottom: 25, marginTop: 10}}>
              <Button ghost type="default" onClick={() => this._sendGimme()}>Refresh</Button>

            </Col>

          </Row>
          <Row style={{marginBottom: 10, marginLeft: 10, bottom: 0, position: 'absolute'}}>
              <Col span={24}>
                <Typography style={{color: "#919191"}}>Scoreboard by NickyRobby#0376</Typography>
              </Col>
          </Row>
          </Content>   
        </Layout>
        )
    }
}