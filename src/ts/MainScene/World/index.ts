import * as THREE from 'three';
import * as ORE from 'ore-three-ts';

import { PowerMesh } from 'power-mesh';

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import CameraControls from 'camera-controls';

export class World extends THREE.Object3D {

	private commonUniforms: ORE.Uniforms;
	private scene: THREE.Scene;

	private gltfLoader: GLTFLoader;
	public model: THREE.Group | null = null;

	private envMapLoader: THREE.CubeTextureLoader;
	private envMap: THREE.CubeTexture | null = null;

	private powerMeshList: PowerMesh[] = [];

	constructor( parentUniforms: ORE.Uniforms, scene: THREE.Scene ) {

		super();

		this.commonUniforms = ORE.UniformsLib.mergeUniforms( parentUniforms, {
		} );

		this.scene = scene;
		this.scene.background = new THREE.Color( "#CCC" );

		/*-------------------------------
			Light
		-------------------------------*/

		// let light = new THREE.DirectionalLight();
		// light.castShadow = true;
		// light.position.set( 5.0, 5.0, 5.0 );
		// light.shadow.bias = - 0.001;
		// light.intensity = 1;
		// this.add( light );

		/*-------------------------------
			glTF Loader
		-------------------------------*/

		this.gltfLoader = new GLTFLoader();

		/*-------------------------------
			CubeTexture Loader
		-------------------------------*/

		this.envMapLoader = new THREE.CubeTextureLoader();

	}

	/*-------------------------------
		glTF
	-------------------------------*/

	public loadGLTF( gltfSrc: string ) {

		this.gltfLoader.load( gltfSrc, ( gltf ) => {

			if ( this.model ) {

				this.disposeGLTF( this.model );

			}

			this.model = gltf.scene;

			this.model.traverse( obj => {

				let mesh = obj as THREE.Mesh;

				mesh.castShadow = true;
				mesh.receiveShadow = true;

				if ( mesh.isMesh ) {

					let powerMesh = new PowerMesh( mesh, {
						uniforms: this.commonUniforms
					}, true );

					powerMesh.position.copy( mesh.position );
					powerMesh.rotation.copy( mesh.rotation );
					powerMesh.scale.copy( mesh.scale );

					powerMesh.castShadow = true;
					powerMesh.receiveShadow = true;

					if ( this.envMap ) {

						powerMesh.updateEnvMap( this.envMap );

					}

					let parent = mesh.parent;

					if ( parent ) {

						parent.add( powerMesh );

						this.powerMeshList.push( powerMesh );

					}

					this.powerMeshList.push( powerMesh );

					mesh.visible = false;

				}

			} );

			this.add( this.model );

			this.dispatchEvent( { type: 'updateModel' } );

		} );

	}

	private disposeGLTF( gltf: THREE.Group ) {

		gltf.traverse( item => {

			let mesh = item as THREE.Mesh | PowerMesh;

			if ( 'isPowerMesh' in mesh ) {

				mesh.dispose();

			} else if ( mesh.isMesh ) {

				mesh.geometry.dispose();

				let mat = mesh.material as THREE.ShaderMaterial;

				if ( 'isShaderMaterial' in mat ) [

					mat.dispose()

				];

			}

		} );

		this.remove( gltf );

	}

	/*-------------------------------
		envMap
	-------------------------------*/

	public loadEnvMap( envMapName: string ) {

		this.envMapLoader.load( [
			'./assets/envmap/' + envMapName + '/px.png',
			'./assets/envmap/' + envMapName + '/nx.png',
			'./assets/envmap/' + envMapName + '/py.png',
			'./assets/envmap/' + envMapName + '/ny.png',
			'./assets/envmap/' + envMapName + '/pz.png',
			'./assets/envmap/' + envMapName + '/nz.png',
		], ( tex => {

			if ( this.envMap ) {

				this.envMap.dispose();
				this.scene.background = null;

			}

			this.scene.background = tex;
			this.envMap = tex;

			this.powerMeshList.forEach( mesh => {

				mesh.updateEnvMap( this.envMap );

			} );

		} ) );

	}

	public fit( camera: THREE.PerspectiveCamera, controls: CameraControls, cameraOffset: THREE.Vector3 = new THREE.Vector3( 2.0, 1.0, 2.0 ) ) {

		if ( ! this.model ) return;

		let fitOffset = 1.5;

		let box = new THREE.Box3();
		let size = new THREE.Vector3();
		let center = new THREE.Vector3();

		box.setFromObject( this.model );
		box.getSize( size );
		box.getCenter( center );

		controls.setTarget( center.x, center.y, center.z );

		const maxSize = Math.max( size.x, size.y, size.z );
		const fitHeightDistance = maxSize / ( 2 * Math.atan( Math.PI * camera.fov / 360 ) );
		const fitWidthDistance = fitHeightDistance / camera.aspect;
		const distance = fitOffset * Math.max( fitHeightDistance, fitWidthDistance );

		const direction = center.clone()
			.sub( center.clone().add( cameraOffset ) )
			.normalize()
			.multiplyScalar( distance );

		camera.near = distance / 100;
		camera.far = distance * 100;
		camera.updateProjectionMatrix();

		let p = center.clone().sub( direction );
		controls.setPosition( p.x, p.y, p.z );

	}

}
