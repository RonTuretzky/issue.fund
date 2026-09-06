// SPDX-License-Identifier: GPL-3.0
/*
    Copyright 2021 0KIMS association.

    This file is generated with [snarkJS](https://github.com/iden3/snarkjs).

    snarkJS is a free software: you can redistribute it and/or modify it
    under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    snarkJS is distributed in the hope that it will be useful, but WITHOUT
    ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
    or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public
    License for more details.

    You should have received a copy of the GNU General Public License
    along with snarkJS. If not, see <https://www.gnu.org/licenses/>.
*/

pragma solidity >=0.7.0 <0.9.0;

contract Groth16Verifier {
    // Scalar field size
    uint256 constant r    = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    // Base field size
    uint256 constant q   = 21888242871839275222246405745257275088696311157297823662689037894645226208583;

    // Verification Key data
    uint256 constant alphax  = 20491192805390485299153009773594534940189261866228447918068658471970481763042;
    uint256 constant alphay  = 9383485363053290200918347156157836566562967994039712273449902621266178545958;
    uint256 constant betax1  = 4252822878758300859123897981450591353533073413197771768651442665752259397132;
    uint256 constant betax2  = 6375614351688725206403948262868962793625744043794305715222011528459656738731;
    uint256 constant betay1  = 21847035105528745403288232691147584728191162732299865338377159692350059136679;
    uint256 constant betay2  = 10505242626370262277552901082094356697409835680220590971873171140371331206856;
    uint256 constant gammax1 = 11559732032986387107991004021392285783925812861821192530917403151452391805634;
    uint256 constant gammax2 = 10857046999023057135944570762232829481370756359578518086990519993285655852781;
    uint256 constant gammay1 = 4082367875863433681332203403145435568316851327593401208105741076214120093531;
    uint256 constant gammay2 = 8495653923123431417604973247489272438418190587263600148770280649306958101930;
    uint256 constant deltax1 = 13827475427050896337643754584152669528284935023326238173293524955057057515602;
    uint256 constant deltax2 = 9376123993361671228876494082186303406667523974500239689702858987031096055881;
    uint256 constant deltay1 = 21758176273254937204290848498320932721287844943433027684818977096825399076570;
    uint256 constant deltay2 = 4332122000988230019824194263048810471992092978925606579422632894068699067819;

    
    uint256 constant IC0x = 12222038563185400095008573141768337418344929727622643890054362842997093006139;
    uint256 constant IC0y = 849353357293855335199097028099938816415713626915067448045756727938752143787;
    
    uint256 constant IC1x = 7902402644232113283297628351157700353851455578317566125942426588707374444082;
    uint256 constant IC1y = 10567831550167716267157937592184142592230904539744343887927687084948154218894;
    
    uint256 constant IC2x = 14057098094071632044003801039952870997223507103187425041663140873649668558557;
    uint256 constant IC2y = 2590767584529302326128456554224375601902299134459420695002217815341042929194;
    
    uint256 constant IC3x = 1339752280277328353518269257454194127703706052145679818497190287517680485449;
    uint256 constant IC3y = 3632797664147228041040983685076535527411091640948538198027503928083123350082;
    
    uint256 constant IC4x = 14901259527235576323307747599080339890499464727452966661897663778113222350844;
    uint256 constant IC4y = 4427178009512005539983048738674596608401239929694034505600052920145845421204;
    
    uint256 constant IC5x = 18451967967570639296029268548291758215595448073443795046160795508223563308172;
    uint256 constant IC5y = 16748773355289046340965768338659732585373965769198391318910164223919092182240;
    
    uint256 constant IC6x = 16612640965801549384626116202322522517154678801479912658850676593514927556236;
    uint256 constant IC6y = 19003906691589392160844380165324541364991230022402698092076736220493448687571;
    
    uint256 constant IC7x = 20762345416532812255651442820488937475793224867171137866963153623917525010486;
    uint256 constant IC7y = 11322647364373747524261975532117510238155085608029577423874438008189969264602;
    
    uint256 constant IC8x = 2912200054207083702774755654783492687139074037366995189558873222774421309808;
    uint256 constant IC8y = 7459780944046670500885038698885988621413333412071182217946665590521151086115;
    
    uint256 constant IC9x = 11176987512429933173743507957771514987608729387393007123582231461992851682875;
    uint256 constant IC9y = 19451988896790837415359956100729571362776255965729779080226710323310445792297;
    
    uint256 constant IC10x = 9873770323363524745762268684015387162785291264230356680472715895621501846519;
    uint256 constant IC10y = 8391956817046707412552101747735924243879834502949855564851034912889103652509;
    
    uint256 constant IC11x = 16226146279797184155642231270242290644236660670375498286002115798877272715089;
    uint256 constant IC11y = 6265645619368193240953699226677225670175843610011545104447073868947030913219;
    
    uint256 constant IC12x = 2195925240923303702879541345503681102359958932667259591886785772413585092001;
    uint256 constant IC12y = 7238950890770822247614128857120695310616084260958742227899434942879184667715;
    
    uint256 constant IC13x = 6033571412006527026335563908637842125520939459202792231000242095512406272503;
    uint256 constant IC13y = 8135161638310435596785738886020104832636402796173022886017117822123691272132;
    
    uint256 constant IC14x = 19676768718881404670376533211659097684836816035778558411222138821906616159744;
    uint256 constant IC14y = 21813503516433591705177290767896389285394851461348223678076948060717135937753;
    
    uint256 constant IC15x = 10741147586426327100917765777070158877532936689755420874169029194779837644839;
    uint256 constant IC15y = 7030058415354262696012481593662328999890528593134112735938675752262931268519;
    
    uint256 constant IC16x = 18108981803181751318336877986487151539623270829455902999753813530936199752102;
    uint256 constant IC16y = 20636273775178999030779575998087206347690526603973687113421963898579546373890;
    
    uint256 constant IC17x = 20152718711686995391134493169484384827766247826316411100479613252866830502064;
    uint256 constant IC17y = 15516335974866044075122592625586589931124133084356081997534930927765912625963;
    
    uint256 constant IC18x = 4193664353289519254593157109105378331549693506842184117637393953323466123566;
    uint256 constant IC18y = 21189884929409833246040113125380901700798416450726046132532928379952805434807;
    
    uint256 constant IC19x = 5534946617113470848991439823236812487101103241407971477588427340602641209095;
    uint256 constant IC19y = 19214971941576502397335208383741210854120101934693740128304323775173412665412;
    
    uint256 constant IC20x = 20482269221957325713218007651589811023965783907926684015559087592884799913034;
    uint256 constant IC20y = 3898253876711740028331955374114132270524913001329200303189592147098327747917;
    
    uint256 constant IC21x = 13727141199979313893077826174111425543083181673742938229078699546948689667728;
    uint256 constant IC21y = 1391522880613064036759185832577110223976831277241245525676765859556079642227;
    
    uint256 constant IC22x = 13451255863604050972631065434892350694809834852634656589856664944992274752127;
    uint256 constant IC22y = 13721201928629952440954689570867103131824997641444787539483857678734174330708;
    
    uint256 constant IC23x = 9718017565134901981770333661970108576934547995665554769877832612028400002682;
    uint256 constant IC23y = 11287117636232373523977431315774419504748736960500337121493835820254554052412;
    
    uint256 constant IC24x = 7962957218929688057855121270970928731198270583651429614108918206169830093655;
    uint256 constant IC24y = 11884710068769306438629211809818634466174672421065770253446014667283677394103;
    
    uint256 constant IC25x = 7631870333365432719884672339222654596828166286831986517172958315905461127655;
    uint256 constant IC25y = 10428602142653686472955154776519006716495234694251463632266888158575722242186;
    
    uint256 constant IC26x = 13271198732795703271041890406956742189719399443995171855318035710130941369877;
    uint256 constant IC26y = 11220624968458041017298957152815256037001315279229257188872100549322986242985;
    
    uint256 constant IC27x = 2136464776083103028997277597704198609845415268582198266502510625729400713242;
    uint256 constant IC27y = 2243796582244910544104492529948394412227870740820548173141712325874088087713;
    
    uint256 constant IC28x = 10870928467546937100315031543569036687884659329694895385175818720723360755891;
    uint256 constant IC28y = 18786338725661330678158943788046822650880054326639292321816931574542887437951;
    
    uint256 constant IC29x = 4779243416854443005464169935752641711737829614000292856274084150767556607468;
    uint256 constant IC29y = 13397491631956246049162365604878391956133051494370860809757730785741947161549;
    
    uint256 constant IC30x = 1170568985370844856330011239449823276452915593163444208952512647771762102588;
    uint256 constant IC30y = 19676497523642652041001377572349699944629131005296219912537157251842072313897;
    
    uint256 constant IC31x = 13252811428334715336184845788553799532560664089099013232149278987531355667950;
    uint256 constant IC31y = 1784359539601156152152916214286457609662025340981418852390021719183912932288;
    
    uint256 constant IC32x = 6876630995711469784792101243030010368249626059020127785815605136096494630556;
    uint256 constant IC32y = 1296336805894540507881090691848610588573719214123691825214313400432707882766;
    
    uint256 constant IC33x = 19535666764296311303948462624947905100357643080582563410966857280730254424547;
    uint256 constant IC33y = 5553080367025569929924557144015433624665568209076566500632909888779693541531;
    
    uint256 constant IC34x = 8972627479495588875315394971492907299446804061327665299544631949978425016425;
    uint256 constant IC34y = 9882128681518628148988615994026004447624362013963772021523405681505051858572;
    
    uint256 constant IC35x = 8452782830790340339671767196087001075157418386817739891476509972569649825838;
    uint256 constant IC35y = 15197325627990627583171669372741952318973153949433866080453975179707397737552;
    
    uint256 constant IC36x = 21077917917018124575128955270137459897785270759322623617227881108625022836206;
    uint256 constant IC36y = 8508177384319799924853094729833975482115628277569321910097888876958071257297;
    
    uint256 constant IC37x = 20640951244736717372995780260341014874166985394496605364966942435302287227941;
    uint256 constant IC37y = 10560839522558050628286411610820808007904432643165954702302573228912501143956;
    
    uint256 constant IC38x = 4209759737330930622457200610316707674812015658126457264618832399712503437960;
    uint256 constant IC38y = 3414268730444845581657412991031102171950328750154934445225519454262090897669;
    
    uint256 constant IC39x = 4292765186538868891359777209167875800172244410098012242042500216534504296503;
    uint256 constant IC39y = 6245186826864204477389650813946298200239787441104187149911898262603814597806;
    
    uint256 constant IC40x = 17410847485546647812228148715639006501187309160590313852834514651259998353781;
    uint256 constant IC40y = 14940002275948261681767306620768372061136427875123909001431663563627652115430;
    
    uint256 constant IC41x = 19013272729153993898219363148317080649230718782835226835055378962116480319415;
    uint256 constant IC41y = 18685322635784550341268511083961418213588117804553534314570233698973021382600;
    
    uint256 constant IC42x = 4352168333868298412831056003107008179645944657844077009276389374161626197941;
    uint256 constant IC42y = 8040992186203038998028263727834249479114977471565753476540148437128597153927;
    
    uint256 constant IC43x = 14191456515900671281236855280872129651342823463189120288866486713166380317522;
    uint256 constant IC43y = 13257365891694482480497746037946606983717559930104099571400417857177251199985;
    
 
    // Memory data
    uint16 constant pVk = 0;
    uint16 constant pPairing = 128;

    uint16 constant pLastMem = 896;

    function verifyProof(uint[2] calldata _pA, uint[2][2] calldata _pB, uint[2] calldata _pC, uint[43] calldata _pubSignals) public view returns (bool) {
        assembly {
            function checkField(v) {
                if iszero(lt(v, r)) {
                    mstore(0, 0)
                    return(0, 0x20)
                }
            }
            
            // G1 function to multiply a G1 value(x,y) to value in an address
            function g1_mulAccC(pR, x, y, s) {
                let success
                let mIn := mload(0x40)
                mstore(mIn, x)
                mstore(add(mIn, 32), y)
                mstore(add(mIn, 64), s)

                success := staticcall(sub(gas(), 2000), 7, mIn, 96, mIn, 64)

                if iszero(success) {
                    mstore(0, 0)
                    return(0, 0x20)
                }

                mstore(add(mIn, 64), mload(pR))
                mstore(add(mIn, 96), mload(add(pR, 32)))

                success := staticcall(sub(gas(), 2000), 6, mIn, 128, pR, 64)

                if iszero(success) {
                    mstore(0, 0)
                    return(0, 0x20)
                }
            }

            function checkPairing(pA, pB, pC, pubSignals, pMem) -> isOk {
                let _pPairing := add(pMem, pPairing)
                let _pVk := add(pMem, pVk)

                mstore(_pVk, IC0x)
                mstore(add(_pVk, 32), IC0y)

                // Compute the linear combination vk_x
                
                g1_mulAccC(_pVk, IC1x, IC1y, calldataload(add(pubSignals, 0)))
                
                g1_mulAccC(_pVk, IC2x, IC2y, calldataload(add(pubSignals, 32)))
                
                g1_mulAccC(_pVk, IC3x, IC3y, calldataload(add(pubSignals, 64)))
                
                g1_mulAccC(_pVk, IC4x, IC4y, calldataload(add(pubSignals, 96)))
                
                g1_mulAccC(_pVk, IC5x, IC5y, calldataload(add(pubSignals, 128)))
                
                g1_mulAccC(_pVk, IC6x, IC6y, calldataload(add(pubSignals, 160)))
                
                g1_mulAccC(_pVk, IC7x, IC7y, calldataload(add(pubSignals, 192)))
                
                g1_mulAccC(_pVk, IC8x, IC8y, calldataload(add(pubSignals, 224)))
                
                g1_mulAccC(_pVk, IC9x, IC9y, calldataload(add(pubSignals, 256)))
                
                g1_mulAccC(_pVk, IC10x, IC10y, calldataload(add(pubSignals, 288)))
                
                g1_mulAccC(_pVk, IC11x, IC11y, calldataload(add(pubSignals, 320)))
                
                g1_mulAccC(_pVk, IC12x, IC12y, calldataload(add(pubSignals, 352)))
                
                g1_mulAccC(_pVk, IC13x, IC13y, calldataload(add(pubSignals, 384)))
                
                g1_mulAccC(_pVk, IC14x, IC14y, calldataload(add(pubSignals, 416)))
                
                g1_mulAccC(_pVk, IC15x, IC15y, calldataload(add(pubSignals, 448)))
                
                g1_mulAccC(_pVk, IC16x, IC16y, calldataload(add(pubSignals, 480)))
                
                g1_mulAccC(_pVk, IC17x, IC17y, calldataload(add(pubSignals, 512)))
                
                g1_mulAccC(_pVk, IC18x, IC18y, calldataload(add(pubSignals, 544)))
                
                g1_mulAccC(_pVk, IC19x, IC19y, calldataload(add(pubSignals, 576)))
                
                g1_mulAccC(_pVk, IC20x, IC20y, calldataload(add(pubSignals, 608)))
                
                g1_mulAccC(_pVk, IC21x, IC21y, calldataload(add(pubSignals, 640)))
                
                g1_mulAccC(_pVk, IC22x, IC22y, calldataload(add(pubSignals, 672)))
                
                g1_mulAccC(_pVk, IC23x, IC23y, calldataload(add(pubSignals, 704)))
                
                g1_mulAccC(_pVk, IC24x, IC24y, calldataload(add(pubSignals, 736)))
                
                g1_mulAccC(_pVk, IC25x, IC25y, calldataload(add(pubSignals, 768)))
                
                g1_mulAccC(_pVk, IC26x, IC26y, calldataload(add(pubSignals, 800)))
                
                g1_mulAccC(_pVk, IC27x, IC27y, calldataload(add(pubSignals, 832)))
                
                g1_mulAccC(_pVk, IC28x, IC28y, calldataload(add(pubSignals, 864)))
                
                g1_mulAccC(_pVk, IC29x, IC29y, calldataload(add(pubSignals, 896)))
                
                g1_mulAccC(_pVk, IC30x, IC30y, calldataload(add(pubSignals, 928)))
                
                g1_mulAccC(_pVk, IC31x, IC31y, calldataload(add(pubSignals, 960)))
                
                g1_mulAccC(_pVk, IC32x, IC32y, calldataload(add(pubSignals, 992)))
                
                g1_mulAccC(_pVk, IC33x, IC33y, calldataload(add(pubSignals, 1024)))
                
                g1_mulAccC(_pVk, IC34x, IC34y, calldataload(add(pubSignals, 1056)))
                
                g1_mulAccC(_pVk, IC35x, IC35y, calldataload(add(pubSignals, 1088)))
                
                g1_mulAccC(_pVk, IC36x, IC36y, calldataload(add(pubSignals, 1120)))
                
                g1_mulAccC(_pVk, IC37x, IC37y, calldataload(add(pubSignals, 1152)))
                
                g1_mulAccC(_pVk, IC38x, IC38y, calldataload(add(pubSignals, 1184)))
                
                g1_mulAccC(_pVk, IC39x, IC39y, calldataload(add(pubSignals, 1216)))
                
                g1_mulAccC(_pVk, IC40x, IC40y, calldataload(add(pubSignals, 1248)))
                
                g1_mulAccC(_pVk, IC41x, IC41y, calldataload(add(pubSignals, 1280)))
                
                g1_mulAccC(_pVk, IC42x, IC42y, calldataload(add(pubSignals, 1312)))
                
                g1_mulAccC(_pVk, IC43x, IC43y, calldataload(add(pubSignals, 1344)))
                

                // -A
                mstore(_pPairing, calldataload(pA))
                mstore(add(_pPairing, 32), mod(sub(q, calldataload(add(pA, 32))), q))

                // B
                mstore(add(_pPairing, 64), calldataload(pB))
                mstore(add(_pPairing, 96), calldataload(add(pB, 32)))
                mstore(add(_pPairing, 128), calldataload(add(pB, 64)))
                mstore(add(_pPairing, 160), calldataload(add(pB, 96)))

                // alpha1
                mstore(add(_pPairing, 192), alphax)
                mstore(add(_pPairing, 224), alphay)

                // beta2
                mstore(add(_pPairing, 256), betax1)
                mstore(add(_pPairing, 288), betax2)
                mstore(add(_pPairing, 320), betay1)
                mstore(add(_pPairing, 352), betay2)

                // vk_x
                mstore(add(_pPairing, 384), mload(add(pMem, pVk)))
                mstore(add(_pPairing, 416), mload(add(pMem, add(pVk, 32))))


                // gamma2
                mstore(add(_pPairing, 448), gammax1)
                mstore(add(_pPairing, 480), gammax2)
                mstore(add(_pPairing, 512), gammay1)
                mstore(add(_pPairing, 544), gammay2)

                // C
                mstore(add(_pPairing, 576), calldataload(pC))
                mstore(add(_pPairing, 608), calldataload(add(pC, 32)))

                // delta2
                mstore(add(_pPairing, 640), deltax1)
                mstore(add(_pPairing, 672), deltax2)
                mstore(add(_pPairing, 704), deltay1)
                mstore(add(_pPairing, 736), deltay2)


                let success := staticcall(sub(gas(), 2000), 8, _pPairing, 768, _pPairing, 0x20)

                isOk := and(success, mload(_pPairing))
            }

            let pMem := mload(0x40)
            mstore(0x40, add(pMem, pLastMem))

            // Validate that all evaluations ∈ F
            
            checkField(calldataload(add(_pubSignals, 0)))
            
            checkField(calldataload(add(_pubSignals, 32)))
            
            checkField(calldataload(add(_pubSignals, 64)))
            
            checkField(calldataload(add(_pubSignals, 96)))
            
            checkField(calldataload(add(_pubSignals, 128)))
            
            checkField(calldataload(add(_pubSignals, 160)))
            
            checkField(calldataload(add(_pubSignals, 192)))
            
            checkField(calldataload(add(_pubSignals, 224)))
            
            checkField(calldataload(add(_pubSignals, 256)))
            
            checkField(calldataload(add(_pubSignals, 288)))
            
            checkField(calldataload(add(_pubSignals, 320)))
            
            checkField(calldataload(add(_pubSignals, 352)))
            
            checkField(calldataload(add(_pubSignals, 384)))
            
            checkField(calldataload(add(_pubSignals, 416)))
            
            checkField(calldataload(add(_pubSignals, 448)))
            
            checkField(calldataload(add(_pubSignals, 480)))
            
            checkField(calldataload(add(_pubSignals, 512)))
            
            checkField(calldataload(add(_pubSignals, 544)))
            
            checkField(calldataload(add(_pubSignals, 576)))
            
            checkField(calldataload(add(_pubSignals, 608)))
            
            checkField(calldataload(add(_pubSignals, 640)))
            
            checkField(calldataload(add(_pubSignals, 672)))
            
            checkField(calldataload(add(_pubSignals, 704)))
            
            checkField(calldataload(add(_pubSignals, 736)))
            
            checkField(calldataload(add(_pubSignals, 768)))
            
            checkField(calldataload(add(_pubSignals, 800)))
            
            checkField(calldataload(add(_pubSignals, 832)))
            
            checkField(calldataload(add(_pubSignals, 864)))
            
            checkField(calldataload(add(_pubSignals, 896)))
            
            checkField(calldataload(add(_pubSignals, 928)))
            
            checkField(calldataload(add(_pubSignals, 960)))
            
            checkField(calldataload(add(_pubSignals, 992)))
            
            checkField(calldataload(add(_pubSignals, 1024)))
            
            checkField(calldataload(add(_pubSignals, 1056)))
            
            checkField(calldataload(add(_pubSignals, 1088)))
            
            checkField(calldataload(add(_pubSignals, 1120)))
            
            checkField(calldataload(add(_pubSignals, 1152)))
            
            checkField(calldataload(add(_pubSignals, 1184)))
            
            checkField(calldataload(add(_pubSignals, 1216)))
            
            checkField(calldataload(add(_pubSignals, 1248)))
            
            checkField(calldataload(add(_pubSignals, 1280)))
            
            checkField(calldataload(add(_pubSignals, 1312)))
            
            checkField(calldataload(add(_pubSignals, 1344)))
            

            // Validate all evaluations
            let isValid := checkPairing(_pA, _pB, _pC, _pubSignals, pMem)

            mstore(0, isValid)
             return(0, 0x20)
         }
     }
 }
