import React from 'react'
import mapboxgl from 'mapbox-gl'
import axios from 'axios'
import Auth from '../lib/Auth'
import UserTrips from './USerTrips'

class Dashboard extends React.Component{

  constructor(props){
    super(props)

    this.state = {
      markersCoord: [],
      map: {},
      mapDOMElement: ''
    }
  }

  calculateDirection(){
    const opposite = this.markersCoord[1].lat - this.markersCoord[0].lat
    const adjacent = this.markersCoord[1].lng - this.markersCoord[0].lng

    return {
      angle: Math.atan(opposite / adjacent),
      direction: this.markersCoord[1].lng - this.markersCoord[0].lng > 0 ? 'east' : 'west'
    }
  }

  drawTrip(map, markers){

    let angle, opposite, adjacent, direction
    const speedFactor = 30 // number of frames per longitude degree
    let startTime = performance.now()
    let progress = 0

    // Create a GeoJSON source with an empty lineString.
    const geojson = {
      'type': 'FeatureCollection',
      'features': [{
        'type': 'Feature',
        'geometry': {
          'type': 'LineString',
          'coordinates': [
            [markers[0].lng, markers[0].lat]
          ] //Starting point
        }
      }]
    }
    // add the line which will be modified in the animation
    map.addLayer({
      'id': 'line-animation',
      'type': 'line',
      'source': {
        'type': 'geojson',
        'data': geojson
      },
      'layout': {
        'line-cap': 'round',
        'line-join': 'round'
      },
      'paint': {
        'line-color': '#ed6498',
        'line-width': 5,
        'line-opacity': .8
      }
    })

    //Calculate angle of the trajectory
    calculateTrajectory()

    animateLine()

    function calculateTrajectory(){
      opposite = markers[1].lat - markers[0].lat
      adjacent = markers[1].lng - markers[0].lng
      angle = Math.atan(opposite / adjacent)

      if(Math.abs(markers[1].lng - markers[0].lng)
        - Math.abs(markers[1].lat - markers[0].lat) >= 0 ){
        direction = markers[1].lng - markers[0].lng > 0 ? 'west' : 'east'
      } else {
        direction = markers[1].lat - markers[0].lat > 0 ? 'north' : 'south'
      }
    }

    function animateLine(timestamp) {

      progress = timestamp - startTime

      let x, y

      switch(direction){
        case 'north':
          y = progress / speedFactor +  markers[0].lat || markers[0].lat
          x = (y - markers[0].lat)  / Math.tan(angle) + markers[0].lng|| markers[0].lng
          break
        case 'west':
          x =  progress / speedFactor +  markers[0].lng || markers[0].lng
          y = (x - markers[0].lng)  * Math.tan(angle) + markers[0].lat|| markers[0].lat
          break
        case 'south':
          y = - progress / speedFactor +  markers[0].lat || markers[0].lat
          x = (y - markers[0].lat)  / Math.tan(angle) + markers[0].lng|| markers[0].lng
          break
        case 'east':
          x =  - progress / speedFactor +  markers[0].lng || markers[0].lng
          y = (x - markers[0].lng)  * Math.tan(angle) + markers[0].lat|| markers[0].lat
          break
      }

      // append new coordinates to the lineString
      geojson.features[0].geometry.coordinates.push([x, y])
      // then update the map
      map.getSource('line-animation').setData(geojson)

      //
      if(x < markers[1].lng && direction === 'east' ||
        x > markers[1].lng && direction === 'west' ||
        y > markers[1].lat && direction === 'north' ||
        y < markers[1].lat && direction === 'south'
      ){
        console.log(markers[1].lng + ' ' + x)
        markers.shift()
        if(markers.length < 2) return
        startTime = timestamp
        calculateTrajectory()
      }
      // Request the next frame of the animation.
      requestAnimationFrame(animateLine)
    }
  }

  createMarkups(){

    this.markersCoord && this.markersCoord.forEach(geoCoord => {

      const markerDOM = document.createElement('img')
      markerDOM.setAttribute('class', 'marker')
      markerDOM.setAttribute('src', 'https://s1.qwant.com/thumbr/0x380/9/3/956b158d13001c1f57346b9fa0932fa2bc0aba7071bdc679d34e390524c1da/2000px-Map_marker.svg.png?u=https%3A%2F%2Fupload.wikimedia.org%2Fwikipedia%2Fcommons%2Fthumb%2F8%2F88%2FMap_marker.svg%2F2000px-Map_marker.svg.png&q=0&b=1&p=0&a=1')

      const markers = new mapboxgl.Marker({element: markerDOM, anchor: 'bottom'})// eslint-disable-line no-unused-vars
        .setLngLat([String(geoCoord.lng), String(geoCoord.lat)])
        .addTo(this.map)
    })
  }

  createMap(){
    mapboxgl.accessToken = process.env.MAPBOX_KEY
    this.map = new mapboxgl.Map({
      container: this.mapDOMElement,
      style: 'mapbox://styles/mapbox/streets-v10',
      center: [0, 0],
      scrollZoom: false,
      zoom: 1
    })
  }

  addUserLocationToTrip(coords){
    if(coords){
      return this.markersCoord.unshift({
        lat: coords.latitude,
        lng: coords.longitude
      })
    }
  }

  getUserLocation(){
    return new Promise(function (resolve, reject) {
      navigator.geolocation.getCurrentPosition(resolve, reject)
    })
  }

  getMarkerCoords(places){
    return new Promise(resolve => {
      this.markersCoord = places.map(place =>
        ({ lat: place.geog[0], lng: place.geog[1] })
      )
      resolve()
    })
  }

  componentDidMount(){

    const user = Auth.getPayload()

    axios(`/api/users/${user.sub}`)
      .then(({ data }) => this.setState({ user: data }))
  }

  componentDidUpdate(){

    this.getMarkerCoords(this.state.user.places)
      .then(() => this.getUserLocation())
      .then(({coords}) => this.addUserLocationToTrip(coords))
      .then(() => this.createMap())
      .then(() => this.createMarkups())
      .then(() => this.map.on('load', () => {
        if(this.markersCoord.length >= 2)
          this.drawTrip(this.map, this.markersCoord)
      }))
  }

  render(){
    return(
      <section id="dash-section">
        <h2 className="dash-title">My Trip</h2>
        <div id='map' ref={element => this.mapDOMElement = element}/>
        {this.state.user && <UserTrips places={this.state.user.places}/>}
      </section>
    )
  }
}

export default Dashboard
